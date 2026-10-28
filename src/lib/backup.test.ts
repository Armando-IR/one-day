import { describe, expect, it } from 'vitest';
import { backupToData, parseBackup } from './backup';

describe('backup', () => {
  it('i vecchi impegni diventano spese una tantum', () => {
    const old = JSON.stringify({
      app: 'finanze', version: 1, settings: {},
      fixed_costs: [{ scope: 'personale', family: 'Casa', name: 'Affitto', amount: 100, frequency: 'mensile' }],
      commitments: [{ name: 'Regalo di nozze', cost: 250, target_month: '2027-01-01', note: 'Lista in agenzia' }],
    });
    const d = backupToData(parseBackup(old));
    expect(d.fixed_costs).toHaveLength(2);
    const r = d.fixed_costs.find((c) => c.name === 'Regalo di nozze')!;
    expect(r).toMatchObject({ frequency: 'una_tantum', due_month: '2027-01-01', amount: 250, scope: 'personale', active: true, note: 'Lista in agenzia' });
    expect(d.fixed_costs.find((c) => c.name === 'Affitto')!.due_month).toBeNull();
  });
  it('una spesa una tantum fa andata e ritorno', () => {
    const d = backupToData(parseBackup(JSON.stringify({
      app: 'finanze', version: 1, settings: {},
      fixed_costs: [{ scope: 'lavoro', name: 'Computer', amount: 1200, frequency: 'una_tantum', due_month: '2027-03-01' }],
    })));
    expect(d.fixed_costs[0]).toMatchObject({ frequency: 'una_tantum', due_month: '2027-03-01', scope: 'lavoro' });
  });
});
