import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TooltipState } from '@/types/nsdl';

interface GlassTooltipProps {
  tooltip: TooltipState;
}

const GlassTooltip: React.FC<GlassTooltipProps> = ({ tooltip }) => {
  return (
    <AnimatePresence>
      {tooltip.visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          style={{ left: tooltip.x, top: tooltip.y }}
          className="fixed z-50 px-4 py-2 bg-white/90 backdrop-blur-md border border-white/20 shadow-xl rounded-xl text-sm font-medium text-slate-700 pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-10px]"
        >
          {tooltip.content}
          <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white/90 rotate-45 border-r border-b border-white/20"></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlassTooltip;
