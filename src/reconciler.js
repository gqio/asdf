import * as THREE from 'three'
import React, { useRef, useEffect, useState } from 'react'
import Reconciler from 'react-reconciler'
import omit from 'lodash-es/omit'
import upperFirst from 'lodash-es/upperFirst'
import ResizeObserver from 'resize-observer-polyfill'

const roots = new Map()
const emptyObject = {}

// This config is supposed to explain to React the target platform,
// What elements it has, how they update, how children are added/removed, etc.
const Renderer = Reconciler({
  supportsMutation: true,
  isPrimaryRenderer: false,
  now: () => Date.now(),
  // Turns a string-type into a real object
  createInstance(type, props, rootContainerInstance, hostContext, internalInstanceHandle) {
    // Here we create the actual Threejs object
    const instance = new THREE[(upperFirst(type))]()
    // Apply some properties
    applyProps(instance, props, {})
    // Then pass it back to React, it will keep it from now on
    return instance
  },
  // Adding children
  appendInitialChild(parentInstance, child) {
    // Both parentInstance and child have already been through "createInstance"
    // React gives us back the original objects here. The ".add()" function comes from Threejs
    if (child) parentInstance.add(child)
  },
  appendChild(parentInstance, child) {
    if (child) parentInstance.add(child)
  },
  appendChildToContainer(parentInstance, child) {
    if (child) parentInstance.add(child)
  },
  // Inserting children
  insertBefore(parentInstance, child, beforeChild) {
    if (child) {
      // Threejs doesn't have inserts, so we dig into its internals a little ...
      child.parent = parentInstance
      child.dispatchEvent({ type: 'added' })
      const index = parentInstance.children.indexOf(beforeChild)
      parentInstance.children = [...parentInstance.children.slice(0, index), child, ...parentInstance.children.slice(index)]
    }
  },
  // Removing children
  removeChild(parentInstance, child) {
    if (child) parentInstance.remove(child)
  },
  removeChildFromContainer(parentInstance, child) {
    if (child) parentInstance.remove(child)
  },
  // Update children props
  commitUpdate(instance, updatePayload, type, oldProps, newProps) {
    applyProps(instance, newProps, oldProps)
  },
  // The rest are just stubs ...
  getPublicInstance(instance) {
    return instance
  },
  getRootHostContext(rootContainerInstance) {
    return emptyObject
  },
  getChildHostContext(parentHostContext, type) {
    return emptyObject
  },
  createTextInstance() {},
  finalizeInitialChildren(instance, type, props, rootContainerInstance) {
    return false
  },
  prepareUpdate(instance, type, oldProps, newProps, rootContainerInstance, hostContext) {
    return emptyObject
  },
  shouldDeprioritizeSubtree(type, props) {
    return false
  },
  prepareForCommit() {},
  resetAfterCommit() {},
  shouldSetTextContent(props) {
    return false
  },
  schedulePassiveEffects(callback) {
    callback()
  },
  cancelPassiveEffects(callback) {}
})

// Works just like ReactDOM.render. "container" is a Threejs object.
export function render(element, container) {
  let root = roots.get(container)
  if (!root) roots.set(container, (root = Renderer.createContainer(container)))
  Renderer.updateContainer(element, root, null, undefined)
  return Renderer.getPublicRootInstance(root)
}

// Same as ReactDOM.unmountComponentAtNode
export function unmountComponentAtNode(container) {
  const root = roots.get(container)
  if (root) Renderer.updateContainer(null, root, null, () => roots.delete(container))
}

// The entry portal, every child of this component is a Threejs object
// It does not take dom nodes ...
export function Canvas({ children, style, ...props }) {
  const canvasRef = useRef()
  const renderer = useRef()
  const camera = useRef()
  const active = useRef(true)
  const [bind, measurements] = useMeasure()
  const [scene] = useState(() => new THREE.Scene())

  useEffect(() => {
    // Setting up Threejs in here, renderloop, boilerplate and all ...
    renderer.current = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true })
    camera.current = new THREE.PerspectiveCamera(75, 0, 0.1, 1000)
    renderer.current.setSize(0, 0, false)
    camera.current.position.z = 5
    const renderLoop = function() {
      if (!active.current) return
      requestAnimationFrame(renderLoop)
      renderer.current.render(scene, camera.current)
    }

    // Kick off render-loop ...
    requestAnimationFrame(renderLoop)

    return () => {
      active.current = false
      unmountComponentAtNode(scene)
    }
  }, [])

  useEffect(() => {
    // Renders our reconciler-root if children have changed
    render(children, scene)
  }, [children])

  useEffect(() => {
    // Recalculate camera-matrix on size changes to the container
    renderer.current.setSize(measurements.width, measurements.height, false)
    const aspect = measurements.width / measurements.height
    camera.current.aspect = aspect
    camera.current.updateProjectionMatrix()
    camera.current.radius = (measurements.width + measurements.height) / 4
  })

  return (
    <div {...bind} {...props} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <canvas ref={canvasRef} />
    </div>
  )
}

// Measures something using ResizeObserver
export function useMeasure() {
  const ref = useRef()
  const [bounds, set] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const [ro] = useState(() => new ResizeObserver(([entry]) => set(entry.contentRect)))
  useEffect(() => {
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [{ ref }, bounds]
}

// This function takes old and new props, then updates the instance
function applyProps(instance, newProps, oldProps) {
  const sameProps = Object.keys(newProps).filter(key => newProps[key] === oldProps[key])
  const handlers = Object.keys(newProps).filter(key => typeof newProps[key] === 'function' && key.startsWith('on'))
  const filteredProps = omit(newProps, [...sameProps, ...handlers, 'children', 'key', 'ref'])
  if (Object.keys(filteredProps).length > 0) {
    Object.entries(filteredProps).map(([key, value]) => {
      const [targetName, ...entries] = key.split('-').reverse()
      const target = entries.reverse().reduce((acc, key) => acc[key.toLowerCase()], instance)
      target[targetName.toLowerCase()] = value
    })
  }
}
