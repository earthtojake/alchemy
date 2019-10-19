import NewSchema, {Schema, Model, Props, getSchema, isSchemaEqual, SCHEMA_ERRORS} from '../src/index'
import * as flat from 'flat' 

type ExtraProps = {
  dotPath: () => string,
  flatten: (obj: any, delimiter?: string) => object,
  flatMap: (obj: any, map: (val: any) => any, delimiter?: string) => object
}

// const props: Props = {

//   dotPath: function() {
//     return this.props.path().join('.')
//   },

//   flatten: function(obj: any, delimiter: string = '.') {

//     this.props.validate(obj, {
//       ignoreRequired: true,
//     })

//     const flatObj = flat.flatten(obj, {delimiter})
//     let basePath = this.props.path().join(delimiter)
//     if (basePath) basePath += delimiter
//     return Object.keys(flatObj).reduce((ret, path) => ({
//       ...ret,
//       [basePath + path]: flatObj[path]
//     }), {})

//   },

//   flatMap: function(obj: any, map: Function, delimiter: string = '.') {

//     const flatObj = this.props.flatten(obj, delimiter)

//     return Object.keys(flatObj).reduce((ret, key) => ({
//       ...ret,
//       [key]: map(flatObj[key])
//     }), {})

//   }

// }

const $uid = 'string'

type User = {
  info: {
    full_name: string,
    dob: number,
    hello?: string,
  },
  friends?: {
    [key: string]: boolean
  }
}

type Root = {
  users: {
    [$uid: string]: User
  }
}

const UserModel: Model<User> = {
  info: {
    full_name: { type: 'string', set: (val: string) => val.toUpperCase() },
    dob: { type: 'number', max: 10, required: true },
    hello: { type: String, default: 'world' },
  },
  friends: {
    [$uid]: { type: Boolean, required: true }
  },
}

const RootModel: Model<Root> = {
  users: {
    [$uid]: UserModel
  }
}

// test each property in schema
type SimpleUser = {
  info: {
    name: string,
    dob: number,
    email: string,
    verified: boolean
  },
  friends?: {
    [key:string]: {
      timestamp: number,
      deleted: boolean
    }
  }
}

const SimpleUserModel: Model<SimpleUser> = {
  info: {
    name: String,
    dob: 'number',
    email: 'string',
    verified: 'Boolean'
  },
  friends: {
    ['string']: {
      timestamp: Number,
      deleted: Boolean
    }
  }
}

type Constraints = {
  requiredStr: string,
  defaultHello: string,
  maxTen: number,
  minFive: number,
  lowerHello: string,
  upperWorld: string,
  trimHi: string,
  matchWow: string,
  enumVowels: string,
  maxTenStr: string,
  minFiveStr: string,
}

const ConstraintsModel:Model<Constraints> = {
  requiredStr: { type: String, required: true },
  defaultHello: { type: String, default: 'hello' },
  maxTen: { type: Number, max: 10 },
  minFive: { type: Number, min: 5 },
  lowerHello: { type: String, lowercase: true },
  upperWorld: { type: String, uppercase: true },
  trimHi: { type: String, trim: true },
  matchWow: { type: String, match: /wow/ },
  enumVowels: { type: String, enum: ['a', 'e', 'i', 'o', 'u']},
  maxTenStr: { type: String, maxlength: 10},
  minFiveStr: { type: String, minlength :5},
}

const expectErrorName = (fn: Function, errName: string): void => {
  let err: Error;
  try {
    fn();
  }
  catch(_err) {
    err = _err;
  }
  expect(err.name).toEqual(errName);
}

test('simple-schema-init', () => {

  const User: Schema<SimpleUser> = NewSchema(SimpleUserModel)

  // path()
  expect(User.props.path()).toEqual([])
  expect(User.info.props.path()).toEqual(['info'])
  expect(User.info.name.props.path()).toEqual(['info', 'name'])
  expect(User.info.dob.props.path()).toEqual(['info', 'dob'])
  expect(User.info.email.props.path()).toEqual(['info', 'email'])
  expect(User.info.verified.props.path()).toEqual(['info', 'verified'])

  expect(User.friends.__factory).toEqual(true)
  expect(User.friends.userA.timestamp.props.path()).toEqual(['friends', 'userA', 'timestamp'])

  // parent()
  expect(isSchemaEqual(User, User.info.props.parent())).toEqual(true)
  expect(isSchemaEqual(User.info.name.props.parent(), User.info)).toEqual(true)
  expect(isSchemaEqual(User.info.props.parent(), User.info)).toEqual(false)
  expect(isSchemaEqual(User.friends.props.parent(), User)).toEqual(true)
  expect(isSchemaEqual(User.friends.userA, User.friends.userB)).toEqual(false)
  expect(isSchemaEqual(User.friends.userA.timestamp.props.parent(), User.friends.userA)).toEqual(true)

})

test('simple-constraints', () => {

  const Constraints = NewSchema(ConstraintsModel)

  // required
  expectErrorName(() =>Constraints.props.validate({}),SCHEMA_ERRORS.REQUIRED)
  expect(() =>Constraints.props.validate({requiredStr:'hello'})).not.toThrowError()

  // maxTen
  expectErrorName(() => Constraints.maxTen.props.validate(11), SCHEMA_ERRORS.MAX)
  expect(() =>Constraints.maxTen.props.validate(9)).not.toThrowError()

  // minFive
  expectErrorName(() =>Constraints.minFive.props.validate(4),SCHEMA_ERRORS.MIN)
  expect(() =>Constraints.maxTen.props.validate(6)).not.toThrowError()

  // matchWow: string,
  expectErrorName(() =>Constraints.matchWow.props.validate('wokawoka'),SCHEMA_ERRORS.MATCH)
  expect(() =>Constraints.matchWow.props.validate('kawowza')).not.toThrowError()

  // enumVowels: string,
  expectErrorName(() =>Constraints.enumVowels.props.validate('w'),SCHEMA_ERRORS.ENUM)
  expect(() =>Constraints.enumVowels.props.validate('a')).not.toThrowError()

  // maxTenStr: string,
  expectErrorName(() =>Constraints.maxTenStr.props.validate('12345678910'),SCHEMA_ERRORS.MAXLENGTH)
  expect(() =>Constraints.maxTenStr.props.validate('abc')).not.toThrowError()

  // minFiveStr: string,
  expectErrorName(() =>Constraints.minFiveStr.props.validate('abc'),SCHEMA_ERRORS.MINLENGTH)
  expect(() =>Constraints.minFiveStr.props.validate('12345678910')).not.toThrowError()

  // lowerHello: string,
  expect(Constraints.lowerHello.props.create('HELLO')).toEqual('hello')

  // upperWorld: string,
  expect(Constraints.upperWorld.props.create('world')).toEqual('WORLD')

  // trimHi: string,
  expect(Constraints.trimHi.props.create('    hi   ')).toEqual('hi')
  expect(Constraints.trimHi.props.create(' hi \t\n')).toEqual('hi')

  // default
  expect(Constraints.defaultHello.props.create(undefined)).toEqual('hello')

})

test('simple-schema-validate', () => {

  const User: Schema<SimpleUser> = NewSchema(SimpleUserModel)

  // type errors
  expectErrorName(() =>User.props.validate({
    info: {
      name: 123,
    }
  }),SCHEMA_ERRORS.TYPE)

  // invalid paths
  expectErrorName(() =>User.props.validate({
    info: {
      blah: true,
    }
  }),SCHEMA_ERRORS.INVALID_PATH)

  // const Root: Schema<Root> = NewSchema(
  //   RootModel,
  // )

  // const testObj = {
  //   users: {
  //     A: {
  //       info: {
  //         full_name: 'jake',
  //         dob: 6,
  //       },
  //       friends: {
  //         B: true,
  //       },
  //     },
  //     B: {
  //       info: {
  //         full_name: 'blake',
  //         dob: 7,
  //       }
  //     }
  //   }
  // }

  // const {
  //   create: createRoot
  // } = Root.props
  
  // const root = createRoot(testObj)

  // const userC = {
  //   info: {
  //     full_name: 'hugh',
  //     dob: 5,
  //   }
  // }
  
  // root.users.C = userC

  // // check values
  // expect(root.users.C.info.full_name).toEqual('HUGH')
  // expect(root.users.C.info.dob).toEqual(5)
  // expect(root.users.C.info.hello).toEqual('world')

});