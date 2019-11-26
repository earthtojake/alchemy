import {
  KeyPath,
} from './interfaces'

export const SCHEMA_ERRORS = {
  INVALID_SCHEMA: 'SchemaError',
  INVALID_PATH: 'SchemaKeyPathError',
  TYPE: 'SchemaTypeError',
  REQUIRED: 'SchemaRequiredError',
  MAX: 'SchemaMaxError',
  MIN: 'SchemaMinError',
  MATCH: 'SchemaMatchError',
  ENUM: 'SchemaEnumError',
  MINLENGTH: 'SchemaMinlengthError',
  MAXLENGTH: 'SchemaMaxlengthError',
  SET: 'SchemaSetError'
}

export class SchemaError extends Error {
  constructor(name: string, message = "", keyPath?: KeyPath) {
    super(message);
    let preMsg = ""
    if (keyPath && keyPath.length > 0) {
      preMsg = `[${keyPath.join(', ')}]`
    }
    this.name = name
    this.message = preMsg ? `${preMsg} ${message}` : message;
  }
}