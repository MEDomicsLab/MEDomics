import { useCallback, useRef, useState } from 'react';
import { Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';

const ResizableGroupNode = ({ data, id, selected }) => {
  const nodeRef = useRef(null);
  const [size, setSize] = useState(data.size || { width: 300, height: 400 });

  const onResize = useCallback((e) => {
    const newWidth = e.clientX - nodeRef.current.getBoundingClientRect().left;
    const newHeight = e.clientY - nodeRef.current.getBoundingClientRect().top;
    setSize({ width: newWidth, height: newHeight });
  }, []);

  return (
    <div
      ref={nodeRef}
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: "rgba(28, 139, 78, 0.4)",
        border: `2px solid ${data.borderColor}`,
        position: 'relative',
        padding: 10,
        boxSizing: 'border-box'
      }}
    >
      <strong>{data.internal.name}</strong>

      {/* Resize handle (bottom-right corner) */}
      <div
        onMouseDown={(e) => {
          document.addEventListener('mousemove', onResize);
          document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', onResize);
          }, { once: true });
        }}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 12,
          height: 12,
          background: '#888',
          cursor: 'nwse-resize'
        }}
      />

      {/* Optional: Handle to allow connections */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default ResizableGroupNode;
