// import schema, {isSchemaEqual, validateModel} from '../src/index'
// import * as flat from 'flat'
// import { SCHEMA_ERRORS } from '../src/error'
// import { Schema, Model } from '../src/interfaces'

// type SimpleUserMethods = {
//   dotKeyPath: () => string,
//   flatten: (obj: any, delimiter?: string) => {[key:string]: any},
//   flatMap: (obj: any, map: (obj: any) => any, delimiter?: string) => {[key:string]: any},
//   sleep: (timeout: number) => Promise<void>,
// }


// function sleep(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// const simpleUserMethods = {

//   dotKeyPath: (schema) => () => {
//     return schema.keyPath().join('.')
//   },

//   flatten: (schema) => (obj, delimiter = '.') => {

//     schema.validate(obj, {
//       ignoreRequired: true,
//     })

//     const flatObj = flat.flatten(obj, {delimiter})
//     let baseKeyPath = schema.keyPath().join(delimiter)
//     if (baseKeyPath) baseKeyPath += delimiter
//     return Object.keys(flatObj).reduce((ret, keyPath) => ({
//       ...ret,
//       [baseKeyPath + keyPath]: flatObj[keyPath]
//     }), {})

//   },

//   flatMap: (schema) => (obj, map, delimiter = '.') => {

//     const flatObj = schema.flatten(obj, delimiter)

//     return Object.keys(flatObj).reduce((ret, key) => ({
//       ...ret,
//       [key]: map(flatObj[key])
//     }), {})

//   },

//   sleep: (_) => async (timeout) => {
//     await sleep(timeout)
//   },

//   coerce: (schema) => (val) => {
//     return schema.cast(val)
//   }

// }

// const $uid = 'string'

// type User = {
//   info: {
//     full_name: string,
//     dob: number,
//     hello?: string,
//   },
//   friends?: {
//     [key: string]: boolean
//   }
// }

// type Root = {
//   users: {
//     [$uid: string]: User
//   }
// }

// const UserModel: Model<User> = {
//   info: {
//     full_name: { type: 'string', set: (val: string) => val.toUpperCase() },
//     dob: { type: 'number', max: 10, required: true },
//     hello: { type: String, default: 'world' },
//   },
//   friends: {
//     [$uid]: { type: Boolean, required: true }
//   },
// }

// const RootModel: Model<Root> = {
//   users: {
//     [$uid]: UserModel
//   }
// }

// // test each property in schema
// type SimpleUser = {
//   info: {
//     name: string,
//     dob: number,
//     email: string,
//     verified: boolean
//   },
//   friends?: {
//     [key:string]: {
//       timestamp: number,
//       deleted: boolean
//     }
//   }
// }

// const SimpleUserModel: Model<SimpleUser> = {
//   info: {
//     name: String,
//     dob: 'number',
//     email: 'string',
//     verified: 'Boolean'
//   },
//   friends: {
//     ['string']: {
//       timestamp: Number,
//       deleted: Boolean
//     }
//   }
// }

// type Constraints = {
//   requiredStr: string,
//   defaultHello: string,
//   maxTen: number,
//   minFive: number,
//   lowerHello: string,
//   upperWorld: string,
//   trimHi: string,
//   matchWow: string,
//   enumVowels: string,
//   maxTenStr: string,
//   minFiveStr: string,
// }

// const ConstraintsModel:Model<Constraints> = {
//   requiredStr: { type: String, required: true },
//   defaultHello: { type: String, default: 'hello' },
//   maxTen: { type: Number, max: 10 },
//   minFive: { type: Number, min: 5 },
//   lowerHello: { type: String, lowercase: true },
//   upperWorld: { type: String, uppercase: true },
//   trimHi: { type: String, trim: true },
//   matchWow: { type: String, match: /wow/ },
//   enumVowels: { type: String, enum: ['a', 'e', 'i', 'o', 'u']},
//   maxTenStr: { type: String, maxlength: 10},
//   minFiveStr: { type: String, minlength :5},
// }

// const expectErrorName = (fn: Function, errName: string): void => {
//   let err: Error;
//   try {
//     fn();
//   }
//   catch(_err) {
//     err = _err;
//   }
//   expect(err.name).toEqual(errName);
// }

// test('simple-schema-init', () => {

//   type TestModel = {
//     hello: string,
//     world: number
//   }
  
//   type TestMethods = {
//     foo: () => string,
//     bar: () => number
//   }

//   schema<TestModel, TestMethods>(
//     {
//       hello: 'string',
//       world: 'number',
//     },
//     {
//       foo: (_) => () => 'bar',
//       bar: (_) => () => 123,
//     }
//   )

//   const User: Schema<SimpleUser> = schema(SimpleUserModel)

//   // keyPath()
//   expect(User.keyPath()).toEqual([])
//   expect(User.info.keyPath()).toEqual(['info'])
//   expect(User.info.name.keyPath()).toEqual(['info', 'name'])
//   expect(User.info.dob.keyPath()).toEqual(['info', 'dob'])
//   expect(User.info.email.keyPath()).toEqual(['info', 'email'])
//   expect(User.info.verified.keyPath()).toEqual(['info', 'verified'])

//   expect(User.friends.__factory).toEqual(true)
//   expect(User.friends.userA.timestamp.keyPath()).toEqual(['friends', 'userA', 'timestamp'])

//   // parent()
//   expect(isSchemaEqual(User, User.info.parent())).toEqual(true)
//   expect(User).toEqual(User.info.parent()) // by reference
//   expect(isSchemaEqual(User.info.name.parent(), User.info)).toEqual(true)
//   expect(isSchemaEqual(User.info.parent(), User.info)).toEqual(false)
//   expect(isSchemaEqual(User.friends.parent(), User)).toEqual(true)
//   expect(isSchemaEqual(User.friends.userA, User.friends.userB)).toEqual(false)
//   expect(isSchemaEqual(User.friends.userA.timestamp.parent(), User.friends.userA)).toEqual(true)

// })

// test('simple-constraints', () => {

//   const Constraints = schema(ConstraintsModel)

//   // required
//   expectErrorName(() =>Constraints.validate({}),SCHEMA_ERRORS.REQUIRED)
//   expect(() =>Constraints.validate({requiredStr:'hello'})).not.toThrowError()

//   // maxTen
//   expectErrorName(() => Constraints.maxTen.validate(11), SCHEMA_ERRORS.MAX)
//   expect(() =>Constraints.maxTen.validate(9)).not.toThrowError()

//   // minFive
//   expectErrorName(() =>Constraints.minFive.validate(4),SCHEMA_ERRORS.MIN)
//   expect(() =>Constraints.maxTen.validate(6)).not.toThrowError()

//   // matchWow: string,
//   expectErrorName(() =>Constraints.matchWow.validate('wokawoka'),SCHEMA_ERRORS.MATCH)
//   expect(() =>Constraints.matchWow.validate('kawowza')).not.toThrowError()

//   // enumVowels: string,
//   expectErrorName(() =>Constraints.enumVowels.validate('w'),SCHEMA_ERRORS.ENUM)
//   expect(() =>Constraints.enumVowels.validate('a')).not.toThrowError()

//   // maxTenStr: string,
//   expectErrorName(() =>Constraints.maxTenStr.validate('12345678910'),SCHEMA_ERRORS.MAXLENGTH)
//   expect(() =>Constraints.maxTenStr.validate('abc')).not.toThrowError()

//   // minFiveStr: string,
//   expectErrorName(() =>Constraints.minFiveStr.validate('abc'),SCHEMA_ERRORS.MINLENGTH)
//   expect(() =>Constraints.minFiveStr.validate('12345678910')).not.toThrowError()

//   // lowerHello: string,
//   expect(Constraints.lowerHello.cast('HELLO')).toEqual('hello')

//   // upperWorld: string,
//   expect(Constraints.upperWorld.cast('world')).toEqual('WORLD')

//   // trimHi: string,
//   expect(Constraints.trimHi.cast('    hi   ')).toEqual('hi')
//   expect(Constraints.trimHi.cast(' hi \t\n')).toEqual('hi')

//   // default
//   expect(Constraints.defaultHello.cast(undefined)).toEqual('hello')

// })

// test('schema-get-set', () => {

//   type GetSetModel = {
//     upperStr: string,
//     oneToTen: number,
//   }

//   const GetSetModel: Model<GetSetModel> = {
//     upperStr: {
//       type: String,
//       set: (str: string) => str.toUpperCase()
//     },
//     oneToTen: {
//       type: Number,
//       get: (_int: number) => {
//         let int = Math.round(_int)
//         if (int > 10) int = 10
//         else if (int < 1) int = 1
//         return int
//       }
//     }
//   }

//   const GetSet = schema(GetSetModel)

//   const obj = GetSet.cast({
//     upperStr: 'hello',
//     oneToTen: 12.275,
//   })

//   expect(obj.upperStr).toEqual('HELLO')
//   expect(obj.oneToTen).toEqual(10)

// })  

// test('simple-schema-methods', async () => {

//   const User: Schema<SimpleUser, SimpleUserMethods> = schema(SimpleUserModel, simpleUserMethods)

//   // dotKeyPath method
//   expect(User.dotKeyPath()).toEqual('')
//   expect(User.info.dotKeyPath()).toEqual('info')
//   expect(User.info.name.dotKeyPath()).toEqual('info.name')
//   expect(User.info.dob.dotKeyPath()).toEqual('info.dob')
//   expect(User.info.email.dotKeyPath()).toEqual('info.email')
//   expect(User.info.verified.dotKeyPath()).toEqual('info.verified')
//   expect(User.friends.userA.timestamp.dotKeyPath()).toEqual('friends.userA.timestamp')

//   const userObj = {
//     info: {
//       name: 'jake',
//       dob: 1996,
//       email: 'jake@email.com',
//       verified: true
//     },
//     friends: {
//       hugh: {
//         timestamp: 10000,
//         deleted: false
//       }
//     }
//   }

//   // flatten method
//   expect(User.flatten(userObj)).toEqual(flat.flatten(userObj))
//   // nested flatten
//   expect(User.info.flatten(userObj.info)).toEqual(Object.keys(flat.flatten(userObj.info)).reduce((dict: object, key: string) => ({...dict, ['info.' + key]: userObj.info[key]}), {}))
//   // flat map
//   expect(User.flatMap(userObj, val => val)).toEqual(flat.flatten(userObj))

//   // async test
//   expect(await User.sleep(100))

// })

// test('simple-schema-validate', () => {

//   const User: Schema<SimpleUser> = schema(SimpleUserModel)

//   // type errors
//   expectErrorName(() =>User.validate({
//     info: {
//       name: 123,
//     }
//   }),SCHEMA_ERRORS.TYPE)

//   // invalid keyPaths
//   expectErrorName(() =>User.validate({
//     info: {
//       blah: true,
//     }
//   }),SCHEMA_ERRORS.INVALID_PATH)

//   // invalid schema value
//   expectErrorName(() => validateModel('swag'), SCHEMA_ERRORS.INVALID_SCHEMA)

//   expectErrorName(() => validateModel({
//     hello: {
//       type: 'thisisbad'
//     }
//   }), SCHEMA_ERRORS.INVALID_SCHEMA)

//   // simple schema value
//   expect(() => validateModel({
//     hello: 'string',
//     hi: String,
//     world: 'String'
//   })).not.toThrowError()

//   expectErrorName(() => validateModel({
//     hello: 'sssstring' // invalid type
//   }), SCHEMA_ERRORS.INVALID_SCHEMA)

//   // complex schema value
//   expect(() => validateModel({
//     hello: {
//       type: 'string',
//       required: true,
//     }
//   })).not.toThrowError()

//   expectErrorName(() => validateModel({
//     hello: {
//       type: 'string',
//       blah: true, // invalid prop
//     }
//   }), SCHEMA_ERRORS.INVALID_SCHEMA)

//   expectErrorName(() => validateModel({
//     keyPath: { // reserved keyword
//       type: 'string'
//     }
//   }), SCHEMA_ERRORS.INVALID_SCHEMA)

//   expectErrorName(() => validateModel({
//     hello: {
//       type: 'string'
//     }
//   }, {
//     hello: () => 'world' // clashing custom method
//   }), SCHEMA_ERRORS.INVALID_SCHEMA)

//   // const Root: Schema<Root> = NewSchema(
//   //   RootModel,
//   // )

//   // const testObj = {
//   //   users: {
//   //     A: {
//   //       info: {
//   //         full_name: 'jake',
//   //         dob: 6,
//   //       },
//   //       friends: {
//   //         B: true,
//   //       },
//   //     },
//   //     B: {
//   //       info: {
//   //         full_name: 'blake',
//   //         dob: 7,
//   //       }
//   //     }
//   //   }
//   // }

//   // const {
//   //   create: createRoot
//   // } = Root
  
//   // const root = createRoot(testObj)

//   // const userC = {
//   //   info: {
//   //     full_name: 'hugh',
//   //     dob: 5,
//   //   }
//   // }
  
//   // root.users.C = userC

//   // // check values
//   // expect(root.users.C.info.full_name).toEqual('HUGH')
//   // expect(root.users.C.info.dob).toEqual(5)
//   // expect(root.users.C.info.hello).toEqual('world')

// });