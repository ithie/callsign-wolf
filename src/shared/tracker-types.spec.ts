import { describe, it, expect } from 'vitest';
import { TRACK_DEFS, INSTRUMENTS, NOTES, STEPS } from './tracker-types';

describe('STEPS', () => {
    it('is 64', () => {
        expect(STEPS).toBe(64);
    });
});

describe('TRACK_DEFS', () => {
    it('is non-empty', () => {
        expect(TRACK_DEFS.length).toBeGreaterThan(0);
    });

    it('all ids are unique', () => {
        const ids = TRACK_DEFS.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('all labels are non-empty strings', () => {
        TRACK_DEFS.forEach(t => {
            expect(typeof t.label).toBe('string');
            expect(t.label.length).toBeGreaterThan(0);
        });
    });

    it('type is either "drum" or "synth" for every track', () => {
        TRACK_DEFS.forEach(t => {
            expect(['drum', 'synth']).toContain(t.type);
        });
    });

    it('contains kick, snare and hat drum tracks', () => {
        const ids = TRACK_DEFS.map(t => t.id);
        expect(ids).toContain('kick');
        expect(ids).toContain('snare');
        expect(ids).toContain('hat');
    });

    it('contains at least one synth track', () => {
        expect(TRACK_DEFS.some(t => t.type === 'synth')).toBe(true);
    });
});

describe('INSTRUMENTS', () => {
    it('has at least one instrument', () => {
        expect(Object.keys(INSTRUMENTS).length).toBeGreaterThan(0);
    });

    it('every instrument has a wave type', () => {
        const validWaves = ['sawtooth', 'square', 'sine', 'triangle'];
        Object.entries(INSTRUMENTS).forEach(([, inst]) => {
            expect(validWaves).toContain(inst.wave);
        });
    });

    it('every instrument has a positive filter cutoff', () => {
        Object.entries(INSTRUMENTS).forEach(([, inst]) => {
            expect(inst.filter).toBeGreaterThan(0);
        });
    });

    it('every instrument has a non-empty label', () => {
        Object.entries(INSTRUMENTS).forEach(([, inst]) => {
            expect(typeof inst.label).toBe('string');
            expect(inst.label.length).toBeGreaterThan(0);
        });
    });

    it('contains known instruments', () => {
        expect(INSTRUMENTS).toHaveProperty('lead_square');
        expect(INSTRUMENTS).toHaveProperty('bass_deep');
        expect(INSTRUMENTS).toHaveProperty('supersaw');
    });

    it('attack and release are >= 0 when defined', () => {
        Object.entries(INSTRUMENTS).forEach(([, inst]) => {
            if (inst.attack  !== undefined) expect(inst.attack).toBeGreaterThanOrEqual(0);
            if (inst.release !== undefined) expect(inst.release).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('NOTES', () => {
    it('is non-empty', () => {
        expect(NOTES.length).toBeGreaterThan(0);
    });

    it('all notes match expected pattern (letter + optional b + octave digit)', () => {
        NOTES.forEach(n => {
            expect(n).toMatch(/^[A-G]b?\d$/);
        });
    });

    it('all notes are unique', () => {
        expect(new Set(NOTES).size).toBe(NOTES.length);
    });

    it('contains middle-A (A4)', () => {
        expect(NOTES).toContain('A4');
    });

    it('contains C1 as the lowest note', () => {
        expect(NOTES).toContain('C1');
    });

    it('contains B4 as the highest note', () => {
        expect(NOTES[0]).toBe('B4');
    });
});
