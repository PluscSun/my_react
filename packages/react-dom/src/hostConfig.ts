import { FiberNode } from 'react-reconciler/src/fiber';
import { HostComponent, HostText } from 'react-reconciler/src/workTags';
import { Props } from 'shared/ReactTypes';
import { DOMElement, updateFiberProps } from './synTheticEvent';

export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

export const createInstance = (type: string, props: Props) => {
  // todo处理props
  const element = document.createElement(type);
  updateFiberProps(element as unknown as DOMElement, props);
  return element as unknown as DOMElement;
};

export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
  return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;

export function commitUpdate(fiber: FiberNode) {
  switch (fiber.tag) {
    case HostText: {
      const text = fiber.memorizedProps.content;
      return commitTextUpdate(fiber.stateNode, text);
    }
    case HostComponent: {
      return updateFiberProps(fiber.stateNode, fiber.memorizedProps);
    }
    default:
      if (__DEV__) {
        console.warn('为实现的Update类型', fiber);
      }
      break;
  }
}

export function commitTextUpdate(testInstance: TextInstance, content: string) {
  testInstance.textContent = content;
}

export function removeChild(
  child: Instance | TextInstance,
  container: Container
) {
  container.removeChild(child);
}

export function insertChildToContainer(
  child: Instance,
  container: Container,
  before: Instance
) {
  container.insertBefore(child, before);
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
