import { describe, it, expect } from 'vitest'
import { parseNaturalLanguageTask } from '../../src/utils/nlpParser'

describe('nlpParser: parseNaturalLanguageTask', () => {
  it('should parse a simple task with no date', () => {
    const result = parseNaturalLanguageTask('Buy groceries')
    expect(result.name).toBe('Buy groceries')
    expect(result.category).toBe('home')
  })

  it('should parse a task with a date', () => {
    const result = parseNaturalLanguageTask('Meeting tomorrow')
    expect(result.name).toBe('Meeting')
    expect(result.date).toBeDefined()
    expect(result.category).toBe('work')
  })

  it('should parse a task with a specific time', () => {
    const result = parseNaturalLanguageTask('Gym at 6pm')
    expect(result.name).toBe('Gym')
    expect(result.time).toBe('18:00')
    expect(result.category).toBe('health')
  })

  it('should handle "remind me to" prefix', () => {
    const result = parseNaturalLanguageTask('remind me to Read a book')
    expect(result.name).toBe('Read a book')
    expect(result.category).toBe('learning')
  })
})
