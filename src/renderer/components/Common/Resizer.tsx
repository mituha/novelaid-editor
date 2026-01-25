import React, { useState, useEffect, useCallback } from 'react';
import './Resizer.css';

interface ResizerProps {
  onResize: (delta: number) => void;
  orientation?: 'vertical' | 'horizontal';
}

export function Resizer({ onResize, orientation = 'vertical' }: ResizerProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor =
      orientation === 'vertical' ? 'col-resize' : 'row-resize';
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = orientation === 'vertical' ? e.movementX : e.movementY;
      onResize(delta);
    },
    [isDragging, onResize, orientation],
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={`resizer ${orientation}`} onMouseDown={handleMouseDown} />
  );
}
