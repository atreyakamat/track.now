import * as chrono from 'chrono-node'

const categories = [
  { id: 'health', keywords: ['health', 'doctor', 'hospital', 'gym', 'workout', 'fitness', 'exercise', 'diet', 'water', 'run', 'walk'] },
  { id: 'learning', keywords: ['study', 'book', 'read', 'learn', 'course', 'class', 'homework', 'assignment', 'exam'] },
  { id: 'finance', keywords: ['money', 'finance', 'pay', 'bill', 'bank', 'invest', 'buy', 'purchase'] },
  { id: 'relationships', keywords: ['friend', 'meet', 'party', 'call', 'family', 'restaurant', 'dinner', 'lunch', 'date'] },
  { id: 'work', keywords: ['work', 'job', 'meeting', 'office', 'boss', 'client', 'project', 'email'] },
  { id: 'home', keywords: ['home', 'clean', 'wash', 'grocery', 'cook', 'kitchen', 'repair', 'fix'] }
]

export function parseNaturalLanguageTask(text) {
  const parsedResults = chrono.parse(text)
  
  let date = null
  let time = null
  let cleanText = text
  
  if (parsedResults.length > 0) {
    const result = parsedResults[0]
    const parsedDate = result.start.date()
    
    const yyyy = parsedDate.getFullYear()
    const mm = String(parsedDate.getMonth() + 1).padStart(2, '0')
    const dd = String(parsedDate.getDate()).padStart(2, '0')
    date = `${yyyy}-${mm}-${dd}`
    
    if (result.start.isCertain('hour')) {
      const hh = String(parsedDate.getHours()).padStart(2, '0')
      const min = String(parsedDate.getMinutes()).padStart(2, '0')
      time = `${hh}:${min}`
    }
    
    cleanText = text.replace(result.text, '').replace(/\s+/g, ' ').trim()
  }

  let category = 'custom'
  const lowerText = text.toLowerCase()
  for (const cat of categories) {
    if (cat.keywords.some(kw => lowerText.includes(kw))) {
      category = cat.id
      break
    }
  }

  cleanText = cleanText.replace(/^(want to|need to|please|schedule that|schedule|remind me to|can you)\s+/i, '')
  cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1)

  return {
    name: cleanText || text,
    originalText: text,
    date,
    time,
    category
  }
}
