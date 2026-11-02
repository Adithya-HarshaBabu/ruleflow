let counter = 0
export const newId = (prefix = 'n') => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`
