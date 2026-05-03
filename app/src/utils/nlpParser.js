import * as chrono from 'chrono-node'

const categories = [
  { id: 'health', keywords: ['health', 'doctor', 'hospital', 'gym', 'workout', 'fitness', 'exercise', 'diet', 'water', 'run', 'walk', 'meditate', 'sleep'] },
  { id: 'learning', keywords: ['study', 'book', 'read', 'learn', 'course', 'class', 'homework', 'assignment', 'exam', 'practice', 'coding', 'language'] },
  { id: 'finance', keywords: ['money', 'finance', 'pay', 'bill', 'bank', 'invest', 'buy', 'purchase', 'tax', 'rent', 'subscription'] },
  { id: 'relationships', keywords: ['friend', 'meet', 'party', 'call', 'family', 'restaurant', 'dinner', 'lunch', 'date', 'anniversary', 'birthday'] },
  { id: 'work', keywords: ['work', 'job', 'meeting', 'office', 'boss', 'client', 'project', 'email', 'presentation', 'report', 'deadline'] },
  { id: 'home', keywords: ['home', 'clean', 'wash', 'grocery', 'cook', 'kitchen', 'repair', 'fix', 'laundry', 'garden', 'pet'] }
]

const priorities = [
  { level: 'high', keywords: ['urgent', 'important', 'asap', 'high priority', 'immediately', 'must'] },
  { level: 'medium', keywords: ['soon', 'medium priority', 'should'] },
  { level: 'low', keywords: ['eventually', 'low priority', 'when I can', 'someday'] }
]

export function parseNaturalLanguageTask(text) {
  const lowerText = text.toLowerCase()
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

  // Detect Priority
  let priority = 'medium'
  for (const p of priorities) {
    if (p.keywords.some(kw => lowerText.includes(kw))) {
      priority = p.level
      // Remove priority keywords from clean text
      p.keywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi')
        cleanText = cleanText.replace(regex, '')
      })
      break
    }
  }

  // Detect Category
  let category = 'custom'
  for (const cat of categories) {
    if (cat.keywords.some(kw => lowerText.includes(kw))) {
      category = cat.id
      break
    }
  }

  // Final Cleanup
  cleanText = cleanText
    .replace(/^(want to|need to|please|schedule that|schedule|remind me to|can you|i have to|don't forget to|set a reminder for)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1)

  return {
    name: cleanText || text,
    originalText: text,
    date,
    time,
    category,
    priority
  }
}
