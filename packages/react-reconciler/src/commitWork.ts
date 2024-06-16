import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  insertChildToContainer,
  removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import {
  ChildDeletion,
  Flags,
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
  Placement,
  Update
} from './fiberFlags';
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText
} from './workTags';
import { Effect, FCUpdateQueue } from './fiberHooks';
import { HookHasEffect } from './hookEffectTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  nextEffect = finishedWork;

  while (nextEffect !== null) {
    // 向下遍历
    const child: FiberNode | null = nextEffect.child;
    if (
      (nextEffect.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags &&
      child !== null
    ) {
      nextEffect = child;
    } else {
      // 向上遍历
      // 遇到的第一个不存在subtreeFlags的节点
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect, root);
        const sibling: FiberNode | null = nextEffect.sibling;

        if (sibling !== null) {
          nextEffect = sibling;
          break up;
        }
        nextEffect = nextEffect.return;
      }
    }
  }
};

const commitMutationEffectsOnFiber = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  const flags = finishedWork.flags;

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update;
  }
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions;
    if (deletions !== null) {
      deletions.forEach((childToDelete) => {
        commitDeletion(childToDelete, root);
      });
    }
    finishedWork.flags &= ~ChildDeletion;
  }
  if ((flags & PassiveEffect) !== NoFlags) {
    // 收集回调
    commitPassiveEffect(finishedWork, root, 'update');
    finishedWork.flags &= ~PassiveEffect;
  }
};

function commitPassiveEffect(
  fiber: FiberNode,
  root: FiberRootNode,
  type: keyof PendingPassiveEffects
) {
  // update
  // unmount
  if (
    fiber.tag !== FunctionComponent ||
    (type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    return;
  }

  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue !== null) {
    if (updateQueue.lastEffect === null && __DEV__) {
      console.error('当FC存在PassiveEffect flag时，不应该不存在Effect');
    }
    root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
  }
}

function commitHookEffectList(
  flags: Flags,
  lastEffect: Effect,
  callback: (effect: Effect) => void
) {
  let effect = lastEffect.next as Effect;

  do {
    if ((effect.tag & flags) === flags) {
      callback(effect);
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

// 触发组件卸载
export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === 'function') {
      destroy();
    }
    // 因为组件已经销毁了，那么应当把effect置为无，不触发后续副作用
    effect.tag &= ~HookHasEffect;
  });
}

// 触发上次更新的destroy
export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === 'function') {
      destroy();
    }
  });
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const create = effect.create;
    if (typeof create === 'function') {
      effect.destroy = create();
    }
  });
}

function recordHostChildrenToDelete(
  childrenToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  // 1.找到第一个root host节点
  const lastOne = childrenToDelete[childrenToDelete.length - 1];

  if (!lastOne) {
    childrenToDelete.push(unmountFiber);
  } else {
    let node = lastOne.sibling;
    while (node !== null) {
      if (unmountFiber === node) {
        childrenToDelete.push(unmountFiber);
      }
      node = node.sibling;
    }
  }
  //2.每找到一个host节点，判断是不是1找到的节点的兄弟节点
}

function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  const rootChildrenToDelete: FiberNode[] = [];

  // 递归子树
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        //TODO 解绑ref
        break;
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case FunctionComponent:
        commitPassiveEffect(unmountFiber, root, 'unmount');
        return;
      default:
        if (__DEV__) {
          console.warn('未处理的unmount类型', unmountFiber);
        }
    }
  });
  // 移除rootHostComponent的DOM
  if (rootChildrenToDelete.length) {
    // 先获取到要删除的节点的hostParent
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      rootChildrenToDelete.forEach((node) => {
        removeChild(node.stateNode, hostParent);
      });
    }
  }
  childToDelete.return = null;
  childToDelete.child = null;
}

function commitNestedComponent(
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  while (true) {
    onCommitUnmount(node);
    if (node.child !== null) {
      // 向下遍历
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === root) {
      // 终止条件
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      // 向上归
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn('执行placement操作', finishedWork);
  }
  // parentDom
  const hostParent = getHostParent(finishedWork);

  // host sibling
  const sibling = getHostSibling(finishedWork);

  // finishedWork ~~ Dom
  if (hostParent !== null) {
    insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
  }
};

function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber;
  findSibling: while (true) {
    // 向上遍历
    while (node.sibling === null) {
      const parent = node.return;

      // 如果没有兄弟节点，且父节点是
      if (
        parent === null ||
        parent.tag === HostComponent ||
        parent.tag === HostRoot
      ) {
        return null;
      }

      node = parent;
    }
    node.sibling.return = node.return;
    node = node.sibling;

    // 要找到Host节点，因此一直循环
    while (node.tag !== HostText && node.tag !== HostComponent) {
      // 向下遍历
      // 如果节点是不稳定节点，也就是会被placement，跳过
      if ((node.flags & Placement) !== NoFlags) {
        continue findSibling;
      }
      if (node.child === null) {
        continue findSibling;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }

    if ((node.flags & Placement) === NoFlags) {
      return node.stateNode;
    }
  }
}

function getHostParent(fiber: FiberNode): Container | null {
  let parent = fiber.return;

  while (parent) {
    const parentTag = parent.tag;
    // HostComponent HostRoot
    if (parentTag === HostComponent) {
      return parent.stateNode as Container;
    }
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container;
    }
    parent = parent.return;
  }

  if (__DEV__) {
    console.warn('未找到HostParent');
  }
  return null;
}

function insertOrAppendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container,
  before?: Instance
) {
  // fiber host
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before);
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }
    return;
  }
  const child = finishedWork.child;
  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;

    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
