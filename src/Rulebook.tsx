import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export function Rulebook({ isOpen, onClose, playerCount = 2 }: { isOpen: boolean; onClose: () => void; playerCount?: number }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="glass-panel w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl p-6 relative custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold mb-6 text-holo-blue neon-text">RULEBOOK</h2>

            <div className="space-y-6 text-sm text-white/90">
              <section>
                <h3 className="text-lg font-semibold text-neon-magenta mb-2">■ 基本ルール</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>9×9の盤面に交互に自分の駒を配置します。</li>
                  <li>各プレイヤーには「真の勝利条件」が1つ割り当てられます。</li>
                  <li>自分の真の勝利条件は自分には見えません（非公開）。</li>
                  <li>他プレイヤーの真の勝利条件は常に見えています。</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-electric-cyan mb-2">■ 勝利条件の仕組み</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>ゲーム開始時、真の勝利条件を含む「候補リスト」が公開されます。</li>
                  <li>候補リストの中のどれかが、あなたの真の勝利条件です。</li>
                  <li>他プレイヤーの条件と候補リストから、自分の条件を推測してください。</li>
                  <li>誰かが自分の真の勝利条件を満たした瞬間、そのプレイヤーの勝利となります。</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-lime-neon mb-2">■ 候補数の変動ロジック</h3>
                <p className="mb-2">プレイ人数に応じて、候補リストの数が変動します。</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>2人戦: 4〜8個 (中央値6が最多)</li>
                  <li>3人戦: 6〜10個 (中央値8が最多)</li>
                  <li>4人戦: 8〜12個 (中央値10が最多)</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">■ マッチとポイント計算</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>ゲーム開始前に「総ゲーム数（1, 3, 5, 10戦）」を設定できます。</li>
                  <li>各ゲーム終了時に、盤面に置かれた自分の駒の数に応じて順位が決まり、ポイントを獲得します。</li>
                </ul>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10 mt-3">
                  <h4 className="font-bold text-white mb-2">現在のポイント配分 ({playerCount}人対戦):</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-white/70">
                    <li><span className="text-lime-neon font-bold">1位 (勝者):</span> {playerCount} ポイント</li>
                    {Array.from({ length: playerCount - 1 }).map((_, i) => (
                      <li key={i}><strong>{i + 2}位:</strong> {Math.max(0, playerCount - (i + 1))} ポイント</li>
                    ))}
                  </ul>
                  <p className="text-xs text-white/50 mt-2">※勝者以外の順位は、盤面上の駒の数が多い順に決定されます。</p>
                </div>
                <p className="mt-2 text-white/70">全ゲーム終了後、累計ポイントが最も高いプレイヤーが総合優勝となります。同点の場合は勝利数が多い方が優先されます。</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-deep-violet mb-2">■ CP難易度説明</h3>
                <ul className="list-disc pl-5 space-y-1">
                 <li><span className="font-bold">Easy:</span> ランダムに配置します。</li>
                  <li><span className="font-bold">Normal:</span> 自分の勝利条件達成を目指して配置します。妨害はしません。</li>
                  <li><span className="font-bold">Hard:</span> 自分の勝利を優先しつつ、他者が1手で勝てる場合は妨害します。</li>
                  <li><span className="font-bold">Expert:</span> 全プレイヤーの脅威を評価し、妨害と自己進捗を同時に最適化します。</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white mb-2">■ 公式競技モード (eスポーツ凍結モード)</h3>
                <p>
                  条件プール、候補分布、制限時間を固定し、シード保存やEloレーティングに対応した競技用モードです。（※本バージョンでは標準ルールとして統合されています）
                </p>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
