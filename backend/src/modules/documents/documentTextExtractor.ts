import path from 'path'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'

function getExtension(fileName: string): string {
  return (path.extname(fileName || '') || '').toLowerCase()
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result.text?.trim() || ''
  } finally {
    await parser.destroy()
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value?.trim() || ''
}

function extractTxtText(buffer: Buffer): string {
  return buffer.toString('utf8').trim()
}

export async function extractDocumentText(buffer: Buffer, fileName: string): Promise<string> {
  const extension = getExtension(fileName)

  if (extension === '.pdf') {
    return extractPdfText(buffer)
  }

  if (extension === '.docx') {
    return extractDocxText(buffer)
  }

  if (extension === '.txt') {
    return extractTxtText(buffer)
  }

  return ''
}
