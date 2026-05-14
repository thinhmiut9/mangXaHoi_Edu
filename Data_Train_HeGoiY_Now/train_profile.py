from __future__ import annotations

from pathlib import Path
import re
import sys
import unicodedata

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent
USER_FILE = DATA_DIR / 'user_now.csv'
RECOMMEND_OUTPUT = DATA_DIR / 'profile_recommendations_all_users.csv'
VIEW_OUTPUT = DATA_DIR / 'profile_recommendations_view.csv'
TOP_K = 20

PROFILE_FIELDS = ('major', 'school', 'location')
TIER_FIELDS = (
    ('major', 'school', 'location'),
    ('major', 'school'),
    ('major', 'location'),
    ('major',),
    ('school', 'location'),
    ('school',),
    ('location',),
)

MAJOR_ALIASES = {
    'cntt': 'cong nghe thong tin',
    'it': 'cong nghe thong tin',
    'cong nghe thong tin': 'cong nghe thong tin',
    'he thong thong tin': 'he thong thong tin',
    'httt': 'he thong thong tin',
    'ke toan': 'ke toan',
    'kt': 'ke toan',
    'quan tri kinh doanh': 'quan tri kinh doanh',
    'qtkd': 'quan tri kinh doanh',
}
def normalize_text(value: object) -> str:
    if value is None or pd.isna(value):
        return ''

    text = str(value).strip().lower()
    if not text or text == 'null':
        return ''

    text = unicodedata.normalize('NFKC', text)
    text = ''.join(char for char in unicodedata.normalize('NFD', text) if unicodedata.category(char) != 'Mn')
    text = re.sub(r'[^a-z0-9\s,]+', ' ', text)
    return ' '.join(text.split())


def normalize_location(value: object) -> str:
    text = normalize_text(value)
    if not text:
        return ''

    # Keep the main location segment so "Dong Nai, Viet Nam" matches "Dong Nai".
    return text.split(',', 1)[0].strip()


def normalize_major(value: object) -> str:
    text = normalize_text(value)
    if not text:
        return ''
    return MAJOR_ALIASES.get(text, text)


def build_candidate_sort_columns(df: pd.DataFrame) -> pd.DataFrame:
    sorted_df = df.copy()
    sorted_df['displayNameSort'] = sorted_df['displayName'].fillna('').map(normalize_text)
    sorted_df['fieldCount'] = sum(sorted_df[f'norm_{field}'].ne('') for field in PROFILE_FIELDS)
    return sorted_df.sort_values(
        by=['fieldCount', 'displayNameSort', 'userId'],
        ascending=[False, True, True],
    ).reset_index(drop=True)


def available_tiers(row: pd.Series) -> list[tuple[str, tuple[str, ...]]]:
    tiers: list[tuple[str, tuple[str, ...]]] = []
    for fields in TIER_FIELDS:
        if all(row[f'norm_{field}'] for field in fields):
            tier_name = '_'.join(fields)
            tiers.append((tier_name, fields))
    return tiers


def build_group_indexes(users_df: pd.DataFrame) -> dict[tuple[str, ...], dict[tuple[str, ...], list[str]]]:
    indexes: dict[tuple[str, ...], dict[tuple[str, ...], list[str]]] = {}

    for fields in TIER_FIELDS:
        grouped: dict[tuple[str, ...], list[str]] = {}
        for _, row in users_df.iterrows():
            key = tuple(row[f'norm_{field}'] for field in fields)
            if any(value == '' for value in key):
                continue
            grouped.setdefault(key, []).append(row['userId'])
        indexes[fields] = grouped

    return indexes


def build_recommendations(users_df: pd.DataFrame) -> pd.DataFrame:
    group_indexes = build_group_indexes(users_df)
    recommendation_rows: list[list[object]] = []
    ordered_user_ids = users_df['userId'].tolist()

    for _, target in users_df.iterrows():
        target_user_id = target['userId']
        matched_ids: set[str] = set()
        ranked_candidates: list[tuple[str, float, str, str]] = []

        for tier_index, (tier_name, fields) in enumerate(available_tiers(target), start=1):
            matched_fields = '+'.join(fields)
            tier_score = float(len(fields))
            key = tuple(target[f'norm_{field}'] for field in fields)
            candidate_ids = group_indexes.get(fields, {}).get(key, [])

            for candidate_user_id in candidate_ids:
                if candidate_user_id == target_user_id or candidate_user_id in matched_ids:
                    continue
                matched_ids.add(candidate_user_id)
                ranked_candidates.append(
                    (
                        candidate_user_id,
                        tier_score,
                        f'tier_{tier_index}_{tier_name}',
                        matched_fields,
                    ),
                )
                if len(ranked_candidates) >= TOP_K:
                    break

            if len(ranked_candidates) >= TOP_K:
                break

        if len(ranked_candidates) < TOP_K:
            for candidate_user_id in ordered_user_ids:
                if candidate_user_id == target_user_id or candidate_user_id in matched_ids:
                    continue

                matched_ids.add(candidate_user_id)
                ranked_candidates.append(
                    (
                        candidate_user_id,
                        0.0,
                        'fallback',
                        '',
                    ),
                )
                if len(ranked_candidates) >= TOP_K:
                    break

        for rank, (recommended_id, score, matched_tier, matched_fields) in enumerate(ranked_candidates, start=1):
            recommendation_rows.append([
                target_user_id,
                recommended_id,
                rank,
                score,
                'profile_rule_based',
                matched_tier,
                matched_fields,
            ])

    return pd.DataFrame(
        recommendation_rows,
        columns=[
            'userId',
            'recommendedUserId',
            'rank',
            'similarityScore',
            'recommendationSource',
            'matchedTier',
            'matchedFields',
        ],
    )


def build_view(recommend_df: pd.DataFrame, users_df: pd.DataFrame) -> pd.DataFrame:
    selected_cols = [
        'userId',
        'displayName',
        'email',
        'location',
        'school',
        'major',
    ]

    view_df = recommend_df.merge(
        users_df[selected_cols],
        on='userId',
        how='left',
    ).rename(
        columns={
            'displayName': 'userDisplayName',
            'email': 'userEmail',
            'location': 'userLocation',
            'school': 'userSchool',
            'major': 'userMajor',
        }
    )

    view_df = view_df.merge(
        users_df[selected_cols],
        left_on='recommendedUserId',
        right_on='userId',
        how='left',
    ).rename(
        columns={
            'displayName': 'recommendedDisplayName',
            'email': 'recommendedEmail',
            'location': 'recommendedLocation',
            'school': 'recommendedSchool',
            'major': 'recommendedMajor',
        }
    )

    return (
        view_df.drop(columns=['userId_y'])
        .rename(columns={'userId_x': 'userId'})
        .sort_values(['userId', 'rank'], ascending=[True, True])
        .reset_index(drop=True)
    )


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

    users_df = pd.read_csv(USER_FILE)

    users_df = users_df[
        users_df['role'].fillna('').eq('USER')
        & users_df['status'].fillna('').eq('ACTIVE')
    ].copy()

    for field in PROFILE_FIELDS:
        if field == 'location':
            normalizer = normalize_location
        elif field == 'major':
            normalizer = normalize_major
        else:
            normalizer = normalize_text
        users_df[f'norm_{field}'] = users_df[field].map(normalizer)

    users_df = build_candidate_sort_columns(users_df)

    print('Active users:', len(users_df))
    for field in PROFILE_FIELDS:
        count = int(users_df[f'norm_{field}'].ne('').sum())
        print(f'{field}: {count}/{len(users_df)} ({count * 100 / len(users_df):.1f}%)')

    recommend_df = build_recommendations(users_df)
    recommend_df.to_csv(RECOMMEND_OUTPUT, index=False, encoding='utf-8')
    print(f'Saved rule-based recommendations to: {RECOMMEND_OUTPUT.name}')

    view_df = build_view(recommend_df, users_df)
    view_df.to_csv(VIEW_OUTPUT, index=False, encoding='utf-8')
    print(f'Saved rule-based recommendation view to: {VIEW_OUTPUT.name}')

    print('\nTier distribution:')
    print(recommend_df['matchedTier'].value_counts().to_string())

    print('\nSample rows:')
    print(view_df.head(10).to_string(index=False))


if __name__ == '__main__':
    main()
