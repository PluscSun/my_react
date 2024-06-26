import {
  Container,
  Instance,
  appendInitialChild,
  createInstance,
  createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText
} from './workTags';
import { NoFlags, Update } from './fiberFlags';

function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
}

export const completeWork = (wip: FiberNode) => {
  const newProps = wip.pendingProps;
  const current = wip.alternate;
  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) {
        // stateNode保存的dom
        // update
        // 1、props是否变化
        // 2、变了 Update flag
        markUpdate(wip);
        // updateFiberProps(wip.stateNode, newProps);
      } else {
        //1.构建dom
        // const instance = createInstance(wip.type, newProps);
        const instance = createInstance(wip.type, newProps);
        //2 DOM插入DOM树
        appendAllChildren(instance, wip);
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case HostText:
      if (current !== null && wip.stateNode) {
        // stateNode保存的dom
        // update
        const oldText = current.memorizedProps.content;
        const newText = newProps.content;
        if (oldText !== newText) {
          markUpdate(wip);
        }
      } else {
        //1.构建dom
        const instance = createTextInstance(newProps.content);
        //2 DOM插入DOM树
        // hostText没有child
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case HostRoot:
    case FunctionComponent:
    case Fragment:
      bubbleProperties(wip);
      return null;
    default:
      if (__DEV__) {
        console.warn('未处理的completework', wip);
      }
      return null;
  }
};

function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
  let node = wip.child;

  while (node !== null) {
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node.stateNode);
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === wip) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === wip) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

// 副作用冒泡
function bubbleProperties(wip: FiberNode) {
  let subtreeFlags = NoFlags;
  let child = wip.child;

  //标记副作用
  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;

    child.return = wip;
    child = child.sibling;
  }
  wip.subtreeFlags |= subtreeFlags;
}
