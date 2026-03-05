import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export function Distribution({ isOpen, onClose, playerCount }: { isOpen: boolean; onClose: () => void; playerCount: number }) {
  const getDistribution = () => {
    if (playerCount === 2) {
      return [
        { count: 4, prob: '10%' },
        { count: 5, prob: '20%' },
        { count: 6, prob: '40%' },
        { count: 7, prob: '20%' },
        { count: 8, prob: '10%' },
      ];
    } else if (playerCount === 3) {
      return [
        { count: 6, prob: '15%' },
        { count: 7, prob: '25%' },
        { count: 8, prob: '30%' },
        { count: 9, prob: '20%' },
        { count: 10, prob: '10%' },
      ];
    } else {
      return [
        { count: 8, prob: '15%' },
        { count: 9, prob: '25%' },
        { count: 10, prob: '30%' },
        { count: 11, prob: '20%' },
        { count: 12, prob: '10%' },
      ];
    }
  };

  const dist = getDistribution();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute top-16 right-4 z-40 glass-panel rounded-xl p-4 w-64 shadow-lg"
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
          
          <h3 className="text-sm font-bold mb-3 text-electric-cyan neon-text">
            候補数分布 ({playerCount}人戦)
          </h3>
          
          <div className="space-y-2 text-sm">
            {dist.map((d) => (
              <div key={d.count} className="flex justify-between items-center">
                <span className="text-white/80">{d.count}個</span>
                <div className="flex-1 mx-3 h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: d.prob }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="h-full bg-electric-cyan"
                  />
                </div>
                <span className="text-electric-cyan font-mono w-10 text-right">{d.prob}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
