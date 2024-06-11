import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import {
  FiberNode,
  createFiberFromElement,
  createFiberFromFragment,
  createWorkInProgress
} from './fiber';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { Fragment, HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

type ExistingChildren = Map<string | number, FiberNode>;

function ChildReconciler(shouldTrackEffects: boolean) {
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
    if (!shouldTrackEffects) {
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
      returnFiber.flags |= ChildDeletion;
    }
  }

  /**
   * @description: 遍历所有兄弟节点删除之
   * @return {*}
   * @use: reconcileSingleElement中，单节点（指变化后只有一个节点）diff，之前的多个节点有一个可复用，删除其他
   */
  function deleteRemainingChildren(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null
  ) {
    if (!shouldTrackEffects) {
      return;
    }
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
  }

  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    const key = element.key;
    while (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        //key相同
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            let props = element.props;
            if (element.type === REACT_FRAGMENT_TYPE) {
              props = element.props.children;
            }
            // type相同，复用
            const existing = useFiber(currentFiber, props);
            existing.return = returnFiber;
            // 当前节点可复用，标记剩下的节点删除
            deleteRemainingChildren(returnFiber, currentFiber.sibling);
            return existing;
          }
          //key相同,type不同不存在可能性，删掉所有旧的
          deleteRemainingChildren(returnFiber, currentFiber);
          break;
        } else {
          if (__DEV__) {
            console.warn('还为实现的react类型', element);
            break;
          }
        }
      } else {
        // key不同, 删掉旧的，遍历sibling找其他的
        deleteChild(returnFiber, currentFiber);
        currentFiber = currentFiber.sibling;
      }
    }
    // mount
    // 根据element创建fiber返回
    let fiber;
    if (element.type === REACT_FRAGMENT_TYPE) {
      fiber = createFiberFromFragment(element.props.children, key);
    } else {
      fiber = createFiberFromElement(element);
    }
    fiber.return = returnFiber;
    return fiber;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    while (currentFiber !== null) {
      //update
      if (currentFiber.tag === HostText) {
        // 类型没变，可以复用
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        deleteRemainingChildren(returnFiber, currentFiber.sibling);
        return existing;
      }
      // <div> -> hahaha类型变了，删掉原来的节点
      deleteChild(returnFiber, currentFiber);
      currentFiber = currentFiber.sibling;
    }
    // mount
    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = returnFiber;
    return fiber;
  }

  function placeSingleChild(fiber: FiberNode) {
    // current fiber为null,首屏渲染
    if (shouldTrackEffects && fiber.alternate === null) {
      fiber.flags |= Placement;
    }
    return fiber;
  }

  function reconcileChildrenArray(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChild: any[]
  ) {
    // 记录当前遍历到的新的childElement在之前数组中的索引
    // 其意义在于，我们知道了在新的数组中当前最靠右的孩子在之前的地位
    // 那么遍历其sibling时，就可以根据index的对比，判断放在哪边
    let lastPlacedIndex: number = 0;
    // 创建的最后一个fiber
    let lastNewFiber: FiberNode | null = null;
    // 创建的第一个fiber
    let firstNewFiber: FiberNode | null = null;

    // 1.将current保存在map中
    const existingChildren: ExistingChildren = new Map();

    let current = currentFirstChild;

    while (current !== null) {
      const keyToUse = current.key !== null ? current.key : current.index;
      existingChildren.set(keyToUse, current);
      current = current.sibling;
    }

    for (let i = 0; i < newChild.length; i++) {
      // 2.遍历newChild，寻找是否可复用
      const after = newChild[i];
      const newFiber = updateFromMap(returnFiber, existingChildren, i, after);
      // 更新后就是null的情况
      if (newFiber === null) {
        continue;
      }

      // 3.标记移动还是插入
      newFiber.index = i;
      newFiber.return = returnFiber;

      if (lastNewFiber === null) {
        lastNewFiber = newFiber;

        firstNewFiber = newFiber;
      } else {
        lastNewFiber.sibling = newFiber;
        lastNewFiber = lastNewFiber.sibling;
      }

      if (!shouldTrackEffects) {
        continue;
      }

      const current = newFiber.alternate;
      if (current !== null) {
        // update
        const oldIndex = current.index;
        if (oldIndex < lastPlacedIndex) {
          // 移动插入
          newFiber.flags |= Placement;
          continue;
        } else {
          // 不移动
          lastPlacedIndex = oldIndex;
        }
      } else {
        //mount插入
        newFiber.flags |= Placement;
      }
    }

    // 4.删除map剩余节点
    existingChildren.forEach((fiber) => {
      deleteChild(returnFiber, fiber);
    });
    return firstNewFiber;
  }

  /**
   * @description: 之前节点map，生成新的fiberNode，或者复用
   * @param {FiberNode} returnFiber
   * @param {ExistingChildren} existingChildren
   * @param {number} index
   * @param {any} element
   * @return { FiberNode | null}
   * @use:
   */
  function updateFromMap(
    returnFiber: FiberNode,
    existingChildren: ExistingChildren,
    index: number,
    element: any
  ): FiberNode | null {
    const keyToUse = element.key !== null ? element.key : index;
    const before = existingChildren.get(keyToUse);

    if (typeof element === 'string' || typeof element === 'number') {
      //HostText
      if (before) {
        if (before.tag === HostText) {
          existingChildren.delete(keyToUse);
          return useFiber(before, { content: element + '' });
        }
      }
      return new FiberNode(HostText, { content: element + '' }, null);
    }

    // ReactElement
    if (typeof element === 'object' && element !== null) {
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (element.type === REACT_FRAGMENT_TYPE) {
            return updateFragment(
              returnFiber,
              before,
              element,
              keyToUse,
              existingChildren
            );
          }
          if (before) {
            if (before.type === element.type) {
              existingChildren.delete(keyToUse);
              return useFiber(before, element.props);
            }
          }
          return createFiberFromElement(element);
      }

      // // TODO 数组类型
      // if (Array.isArray(element) && __DEV__) {
      //   console.warn('还未实现数组类型child');
      //   return null;
      // }
    }

    if (Array.isArray(element)) {
      return updateFragment(
        returnFiber,
        before,
        element,
        keyToUse,
        existingChildren
      );
    }
    return null;
  }

  return function reconcileChildFibers(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    newChild?: any
  ) {
    // 判断Fragment
    const isUnkeyedTopLevelFragment =
      typeof newChild === 'object' &&
      newChild !== null &&
      newChild.type === REACT_FRAGMENT_TYPE &&
      newChild.key === null;
    if (isUnkeyedTopLevelFragment) {
      newChild = newChild?.props.children;
    }
    // 判断当前fiber类型
    // React Element
    if (typeof newChild === 'object' && newChild !== null) {
      // 多节点情况
      if (Array.isArray(newChild)) {
        return reconcileChildrenArray(returnFiber, currentFiber, newChild);
      }
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFiber, newChild)
          );
        default:
          if (__DEV__) {
            console.warn('为实现的reconcile类型', newChild);
          }
          break;
      }
    }
    // HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }

    // 兜底删除
    if (currentFiber !== null) {
      deleteRemainingChildren(returnFiber, currentFiber);
    }

    if (__DEV__) {
      console.warn('未实现的reconcile类型', newChild);
    }
    return null;
  };
}

/**
 * @description: 复用fiber生成新fiber
 * @param {FiberNode} fiber
 * @return {*}
 * @use:
 */
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

function updateFragment(
  returnFiber: FiberNode,
  current: FiberNode | undefined,
  elements: any[],
  key: Key,
  existingChildren: ExistingChildren
) {
  let fiber;
  if (!current || current.tag !== Fragment) {
    fiber = createFiberFromFragment(elements, key);
  } else {
    existingChildren.delete(key);
    fiber = useFiber(current, elements);
  }
  fiber.return = returnFiber;
  return fiber;
}

// 追踪副作用
export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
