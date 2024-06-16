import { FiberNode } from 'react-reconciler/src/fiber';
import { HostText } from 'react-reconciler/src/workTags';
import { Props } from 'shared/ReactTypes';

export interface Container {
  rootID: number;
  children: (Instance | TextInstance)[];
}

export interface Instance {
  id: number;
  type: string;
  children: (Instance | TextInstance)[];
  parent: number;
  props: Props;
}

export interface TextInstance {
  text: string;
  id: number;
  parent: number;
}

let instanceCounter = 0;

export const createInstance = (type: string, props: Props) => {
  const instance = {
    id: instanceCounter++,
    type,
    children: [],
    parent: -1,
    props
  };
  return instance;
};

export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  // 指向父亲id
  const prevParentID = child.parent;
  const ParentID = 'rootID' in parent ? parent.rootID : parent.id;

  if (prevParentID !== -1 && prevParentID !== ParentID) {
    throw new Error('不能重复挂载child');
  }
  child.parent = ParentID;
  parent.children.push(child);
};

export const createTextInstance = (content: string) => {
  const instance = {
    text: content,
    id: instanceCounter++,
    parent: -1
  };
  return instance;
};

export const appendChildToContainer = (parent: Container, child: Instance) => {
  // 指向父亲id
  const prevParentID = child.parent;

  if (prevParentID !== -1 && prevParentID !== parent.rootID) {
    throw new Error('不能重复挂载child');
  }
  child.parent = parent.rootID;
  parent.children.push(child);
};

export function commitUpdate(fiber: FiberNode) {
  switch (fiber.tag) {
    case HostText: {
      const text = fiber.memorizedProps.content;
      return commitTextUpdate(fiber.stateNode, text);
    }
    default:
      if (__DEV__) {
        console.warn('为实现的Update类型', fiber);
      }
      break;
  }
}

export function commitTextUpdate(testInstance: TextInstance, content: string) {
  testInstance.text = content;
}

export function removeChild(
  child: Instance | TextInstance,
  container: Container
) {
  const index = container.children.indexOf(child);

  if (index === -1) {
    throw new Error('child不存在');
  }
  container.children.splice(index, 1);
}

export function insertChildToContainer(
  child: Instance,
  container: Container,
  before: Instance
) {
  const beforeIndex = container.children.indexOf(before);
  if (beforeIndex === -1) {
    throw new Error('before不存在');
  }
  const index = container.children.indexOf(child);
  if (index !== -1) {
    container.children.splice(index, 1);
  }
  container.children.splice(beforeIndex, 0, child);
}

/**
 * @description: 调度任务微任务和执行环境相关
 * @return {*}
 * @use:
 */
export const scheduleMicroTask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof Promise === 'function'
      ? (callback: (...args: any) => void) =>
          Promise.resolve(null).then(callback)
      : setTimeout;
