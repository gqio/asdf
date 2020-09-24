import * as THREE from 'three'
import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { Canvas } from './reconciler'
import './styles.css'

function Test() {
  const [active, set] = useState(false)
  useEffect(() => void setInterval(() => set(a => !a), 200), [])
  return (
    <group>
      <mesh
        geometry={new THREE.BoxGeometry(1, 1, 1)}
        material={new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true })}
        material-color={new THREE.Color(active ? 'hotpink' : 'lightblue')}
        rotation-x={2}
      />
    </group>
  )
}

ReactDOM.render(
  <Canvas>
    <Test />
  </Canvas>,
  document.getElementById('root')
)
