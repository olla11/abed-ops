import { readdir, readFile } from 'fs/promises'
import path from 'path'

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge')
const MAX_TOTAL_CHARS = 400_000
const MAX_PER_FILE_CHARS = 80_000

let cache: { text: string; loadedAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pdf') {
    const pdfParse = (await import('pdf-parse')).default
    const buf = await readFile(filePath)
    const { text } = await pdfParse(buf)
    return text
  }
  if (ext === '.txt' || ext === '.md') {
    return readFile(filePath, 'utf-8')
  }
  if (ext === '.docx') {
    const mammoth = (await import('mammoth')).default
    const buf = await readFile(filePath)
    const { value } = await mammoth.extractRawText({ buffer: buf })
    return value
  }
  return ''
}

// Lecture par fichier (sans concaténation ni troncature), utilisée pour l'indexation RAG
export async function loadKnowledgeFilesRaw(): Promise<{ name: string; text: string }[]> {
  let entries: string[] = []
  try {
    entries = await readdir(KNOWLEDGE_DIR)
  } catch {
    return []
  }

  const files: { name: string; text: string }[] = []
  for (const name of entries) {
    if (!/\.(pdf|txt|md|docx)$/i.test(name)) continue
    try {
      const raw = (await extractText(path.join(KNOWLEDGE_DIR, name))).trim()
      if (raw) files.push({ name, text: raw })
    } catch (e) {
      console.error('[aga-files] erreur lecture', name, e)
    }
  }
  return files
}

export async function loadKnowledgeFiles(): Promise<string> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.text

  let entries: string[] = []
  try {
    entries = await readdir(KNOWLEDGE_DIR)
  } catch {
    return ''
  }

  const sections: string[] = []
  let total = 0

  for (const name of entries) {
    if (!/\.(pdf|txt|md|docx)$/i.test(name)) continue
    if (total >= MAX_TOTAL_CHARS) break
    try {
      const raw = (await extractText(path.join(KNOWLEDGE_DIR, name))).trim()
      if (!raw) continue
      const truncated = raw.slice(0, MAX_PER_FILE_CHARS)
      const section = `## ${name}\n${truncated}`
      total += section.length
      sections.push(section)
    } catch (e) {
      console.error('[aga-files] erreur lecture', name, e)
    }
  }

  const text = sections.join('\n\n').slice(0, MAX_TOTAL_CHARS)
  cache = { text, loadedAt: Date.now() }
  return text
}
