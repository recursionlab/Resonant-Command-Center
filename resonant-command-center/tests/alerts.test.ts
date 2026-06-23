/**
 * TDD: Replace blocking alert() with non-blocking showModal()
 * 
 * RED phase: This test should FAIL before the fix (because alert() IS present)
 * GREEN phase: This test should PASS after the fix (alert() replaced with showModal())
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const INDEX_TSX_PATH = resolve(__dirname, '..', 'index.tsx');
const UI_TS_PATH = resolve(__dirname, '..', 'src', 'ui.ts');

describe('Node/Link injection — non-blocking error feedback', () => {
  let indexCode: string;
  let uiCode: string;

  beforeAll(() => {
    indexCode = readFileSync(INDEX_TSX_PATH, 'utf-8');
    uiCode = readFileSync(UI_TS_PATH, 'utf-8');
  });

  it('should NOT use alert() for duplicate node error', () => {
    const hasAlertOnDuplicateNode = /alert\s*\(\s*["']Node already exists\.\s*["']\s*\)/.test(indexCode);
    expect(hasAlertOnDuplicateNode,
      'alert("Node already exists.") should be replaced with showModal()'
    ).toBe(false);
  });

  it('should NOT use alert() for missing source/target error', () => {
    const hasAlertOnMissingNodes = /alert\s*\(\s*["']Please select both source and target nodes\.\s*["']\s*\)/.test(indexCode);
    expect(hasAlertOnMissingNodes,
      'alert("Please select both source and target nodes.") should be replaced with showModal()'
    ).toBe(false);
  });

  it('should NOT use alert() for same source/target error', () => {
    const hasAlertOnSameNodes = /alert\s*\(\s*["']Source and target must be different nodes\.\s*["']\s*\)/.test(indexCode);
    expect(hasAlertOnSameNodes,
      'alert("Source and target must be different nodes.") should be replaced with showModal()'
    ).toBe(false);
  });

  it('should NOT use alert() for duplicate link error', () => {
    const hasAlertOnDuplicateLink = /alert\s*\(\s*["']Link already exists\.\s*["']\s*\)/.test(indexCode);
    expect(hasAlertOnDuplicateLink,
      'alert("Link already exists.") should be replaced with showModal()'
    ).toBe(false);
  });

  it('should have showModal() defined and used for error feedback', () => {
    // showModal may be in src/ui.ts (extracted module) or index.tsx
    const hasShowModalDef = /function showModal\(/.test(uiCode) || /function showModal\(/.test(indexCode);
    expect(hasShowModalDef, 'showModal() function should be defined in src/ui.ts or index.tsx').toBe(true);

    // Verify showModal is used (at least 4 times across both files)
    const showModalCalls = ((indexCode + uiCode).match(/showModal\(/g) || []).length;
    expect(showModalCalls).toBeGreaterThanOrEqual(4);
  });
});
