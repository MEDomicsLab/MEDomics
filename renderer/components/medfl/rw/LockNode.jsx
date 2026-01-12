import { set } from "lodash"
import React, { useContext, useEffect } from "react"
import { FaLock, FaLockOpen } from "react-icons/fa"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

export default function LockNode({ id, data }) {
  const { updateNode } = useContext(FlowFunctionsContext)

  const [isLocked, setIsLocked] = React.useState(data.internal.isLocked || false)

  const toggleLock = () => {
    setIsLocked(!isLocked)
    data.internal.isLocked = !isLocked

    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  return (
    <div style={{ cursor: "pointer" }} className="d-flex justify-content-end p-1" onClick={toggleLock}>
      {isLocked ? <FaLock className="text-warning " /> : <FaLockOpen className=" text-secondary" />}
    </div>
  )
}
