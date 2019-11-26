import firebase from 'firebase'
import { Schema } from './interfaces'

export interface FirebaseMethods<T> {
  ref: () => firebase.database.Reference,
  refPath: () => string,
  refSet: (value: any) => Promise<T>,
  refOnce: () => Promise<T | null>
}

export const firebaseProps = {
  ref: true,
  refPath: true,
  refSet: true,
  refOnce: true
}

export function createFirebaseMethods<T>(
  schema: Schema<T>, 
  firebaseApp: firebase.app.App
): FirebaseMethods<T> {

  const db = firebaseApp.database()

  return {
    ref: () => {
      return db.ref(schema.refPath())
    },
    refPath: () => {
      return schema.keyPath().join('/')
    },
    refSet: async (_value) => {
      const value = schema.cast(_value)
      await schema.ref().set(value)
      return value
    },
    refOnce: async function() {
      const snap = await schema.ref().once('value')
      if (snap.val()) return schema.cast(snap.val())
      else return null
    }
  } 
  
}