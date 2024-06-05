import { Props, ReactElementType } from 'shared/ReactTypes';
import {
  FiberNode,
  createFiberFromElement,
  createWorkInProgress
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

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

  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    const key = element.key;
    work: if (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        //key相同
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            // type相同，复用
            const existing = useFiber(currentFiber, element.props);
            existing.return = returnFiber;
            return existing;
          }
          //key相同type不同删掉旧的
          deleteChild(returnFiber, currentFiber);
          break work;
        } else {
          if (__DEV__) {
            console.warn('还为实现的react类型', element);
            break work;
          }
        }
      } else {
        // 删掉旧的
        deleteChild(returnFiber, currentFiber);
      }
    }
    // 根据element创建fiber返回
    const fiber = createFiberFromElement(element);
    fiber.return = returnFiber;
    return fiber;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    if (currentFiber !== null) {
      //update
      if (currentFiber.tag === HostText) {
        // 类型没变，可以复用
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        return existing;
      }
      // <div> -> hahaha类型变了，删掉原来的节点
      deleteChild(returnFiber, currentFiber);
    }
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

  return function reconcileChildFibers(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    newChild?: ReactElementType
  ) {
    // 判断当前fiber类型
    if (typeof newChild === 'object' && newChild !== null) {
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
    // return fiberNode
    // TODO 多节点
    // HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }

    // 兜底删除
    if (currentFiber !== null) {
      deleteChild(returnFiber, currentFiber);
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

// 追踪副作用
export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
