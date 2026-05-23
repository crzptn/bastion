import { STARTER_MAP } from '../game';
import { GameCanvas } from '../game/render/GameCanvas';

export function PlayPage() {
  return (
    <section className="flex flex-col gap-4" style={{ height: 'calc(100vh - 8rem)' }}>
      <h2 className="text-xl font-semibold">Play</h2>
      <div className="flex-1 min-h-0">
        <GameCanvas
          map={STARTER_MAP}
          onCellClick={(pos) => console.log('cell', pos)}
        />
      </div>
    </section>
  );
}
