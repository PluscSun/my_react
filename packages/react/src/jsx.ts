import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import {
  ElementType,
  Key,
  Props,
  Ref,
  Type,
  ReactElementType
} from 'shared/ReactTypes';

// ReactElement
const ReactElement = function (
  type: Type,
  key: Key,
  ref: Ref,
  props: Props
): ReactElementType {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
    __mark: 'jx'
  };
  return element;
};

export function isValidElement(object: any) {
  return (
    typeof object === 'object' &&
    object !== null &&
    object.$$typeof === REACT_ELEMENT_TYPE
  );
}

export const jsx = (
  type: ElementType,
  config: any,
  ...maybeChildren: any[]
) => {
  // 需要特殊处理三个属性
  let key: Key = null;
  let ref: Ref = null;
  const props: Props = {};

  // 遍历config的键
  for (const prop in config) {
    // config的值
    const val = config[prop];
    // 处理key，转字符串
    if (prop === 'key') {
      if (val !== undefined) {
        key = '' + val;
      }
      continue;
    }
    // 处理ref
    if (prop === 'ref') {
      if (val != undefined) {
        ref = val;
      }
      continue;
    }
    // 处理其他非原型链上属性
    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }
  const maybeChildrenLength = maybeChildren.length;
  if (maybeChildrenLength >= 1) {
    if (maybeChildrenLength === 1) {
      props.children = maybeChildren[0];
    } else {
      props.children = maybeChildren;
    }
  }
  return ReactElement(type, key, ref, props);
};

export const jsxDEV = (type: ElementType, config: any) => {
  // 需要特殊处理三个属性
  let key: Key = null;
  let ref: Ref = null;
  const props: Props = {};

  // 遍历config的键
  for (const prop in config) {
    // config的值
    const val = config[prop];
    // 处理key，转字符串
    if (prop === 'key') {
      if (val !== undefined) {
        key = '' + val;
      }
      continue;
    }
    // 处理ref
    if (prop === 'ref') {
      if (val != undefined) {
        ref = val;
      }
      continue;
    }
    // 处理其他非原型链上属性
    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }
  return ReactElement(type, key, ref, props);
};
