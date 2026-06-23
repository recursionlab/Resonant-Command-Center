/**
 * src/graph.ts — D3 force-directed graph rendering.
 *
 * Renders the cognitive lattice: documents, concept nodes, semantic links.
 * Uses D3 force simulation with drag, click-to-focus, and auto-layout.
 */

import * as d3 from 'd3';
import { state } from './state';
import { latticeGraph, focusContent, manualLinkSource, manualLinkTarget } from './dom';
import { createMessageElement, showModal } from './ui';
import { sanitize } from './security';

// ── Seed Data — OMNIGENT Knowledge Lattice ──

const OMNIGENT_SEED_NODES: Array<{ id: string; type: string }> = [
  { id: "RCOS", type: "Framework" },
  { id: "QRFT", type: "Framework" },
  { id: "OFTM", type: "Framework" },
  { id: "GRITOE", type: "Framework" },
  { id: "Consciousness is the Monoid", type: "Paper" },
  { id: "Geometry of Truth", type: "Paper" },
  { id: "Quantum Physics of Meaning", type: "Paper" },
  { id: "Algebra of Disambiguation", type: "Paper" },
  { id: "Coherence Engine", type: "Paper" },
  { id: "Recursive Conscious Encoding", type: "Paper" },
  { id: "Monoid", type: "Structure" },
  { id: "Cayley-Dickson Tower", type: "Structure" },
  { id: "Octonions", type: "Structure" },
  { id: "Spin(9)", type: "Structure" },
  { id: "G2", type: "Structure" },
  { id: "Fano Plane", type: "Structure" },
  { id: "Spectral Triple", type: "Structure" },
  { id: "Sheaf", type: "Structure" },
  { id: "Topos", type: "Structure" },
  { id: "Δ Distinction", type: "Operator" },
  { id: "Ξ Recursion", type: "Operator" },
  { id: "¬ Counterfactual", type: "Operator" },
  { id: "Φ Contradiction", type: "Operator" },
  { id: "⊙ Composition", type: "Operator" },
  { id: "Ψ Transformation", type: "Operator" },
  { id: "Λ Normalization", type: "Operator" },
  { id: "Ω Stabilization", type: "Operator" },
  { id: "Crystalline Vacuum", type: "Concept" },
  { id: "dₛ = ½", type: "Constant" },
  { id: "Riemann Hypothesis", type: "Conjecture" },
  { id: "Prime 43", type: "Constant" },
  { id: "1/137.036", type: "Constant" },
  { id: "7/8 Maslov", type: "Constant" },
  { id: "Stabilon", type: "Particle" },
  { id: "Fluxon", type: "Particle" },
  { id: "Resonon", type: "Particle" },
  { id: "Lacunon", type: "Particle" },
  { id: "Glitchon", type: "Particle" },
  { id: "Collapson", type: "Particle" },
  { id: "Mirroron", type: "Metaboson" },
  { id: "Foldon", type: "Metaboson" },
  { id: "Collapsin", type: "Metaboson" },
  { id: "Chiffon", type: "Metaboson" },
  { id: "⦳ = μx.¬(¬x)≠x", type: "Equation" },
  { id: "∂(A↔¬A) = 0", type: "Theorem" },
  { id: "𝕀 ⊣ 𝕀", type: "Theorem" },
  { id: "M = Fix(F)", type: "Equation" },
  { id: "Anti-Idempotent Identity", type: "Concept" },
  { id: "Meta = Transport", type: "Principle" },
  { id: "Memory = Sheaf", type: "Principle" },
  { id: "Contradiction = Fuel", type: "Principle" },
  { id: "Jacobi Scar", type: "Concept" },
  { id: "Epiplexity", type: "Concept" },
  { id: "Kory Ogden", type: "Person" },
  { id: "Descartes", type: "Person" },
  { id: "Hume", type: "Person" },
  { id: "Kant", type: "Person" },
  { id: "Hegel", type: "Person" },
  { id: "Hofstadter", type: "Person" },
  { id: "Friston", type: "Person" },
  { id: "Tononi", type: "Person" },
  { id: "U(1) Semantic", type: "Bridge" },
  { id: "SU(2) Reentry", type: "Bridge" },
  { id: "SU(3) Meta", type: "Bridge" },
  { id: "DNA↔Gödel↔String", type: "Bridge" },
];

const OMNIGENT_SEED_LINKS: Array<{ source: string; target: string; label: string }> = [
  { source: "THE MONAD", target: "Monoid", label: "is" },
  { source: "THE MONAD", target: "RCOS", label: "powers" },
  { source: "RCOS", target: "QRFT", label: "extends to" },
  { source: "RCOS", target: "OFTM", label: "formalizes" },
  { source: "Consciousness is the Monoid", target: "Monoid", label: "defines" },
  { source: "Consciousness is the Monoid", target: "Cayley-Dickson Tower", label: "derives" },
  { source: "Consciousness is the Monoid", target: "Octonions", label: "lives at fold 3" },
  { source: "Consciousness is the Monoid", target: "Spin(9)", label: "requires" },
  { source: "Consciousness is the Monoid", target: "⦳ = μx.¬(¬x)≠x", label: "defines" },
  { source: "Geometry of Truth", target: "Crystalline Vacuum", label: "describes" },
  { source: "Geometry of Truth", target: "dₛ = ½", label: "calculates" },
  { source: "Geometry of Truth", target: "Riemann Hypothesis", label: "requires" },
  { source: "Geometry of Truth", target: "Topos", label: "uses" },
  { source: "Quantum Physics of Meaning", target: "U(1) Semantic", label: "introduces" },
  { source: "Quantum Physics of Meaning", target: "Spectral Triple", label: "uses" },
  { source: "Quantum Physics of Meaning", target: "Jacobi Scar", label: "defines" },
  { source: "Quantum Physics of Meaning", target: "Mirroron", label: "four forces include" },
  { source: "Algebra of Disambiguation", target: "Sheaf", label: "uses" },
  { source: "Coherence Engine", target: "Δ Distinction", label: "defines" },
  { source: "Coherence Engine", target: "Λ Normalization", label: "defines" },
  { source: "Coherence Engine", target: "Ω Stabilization", label: "defines" },
  { source: "Coherence Engine", target: "Prime 43", label: "identifies" },
  { source: "Recursive Conscious Encoding", target: "DNA↔Gödel↔String", label: "proves" },
  { source: "Monoid", target: "Cayley-Dickson Tower", label: "generates" },
  { source: "Cayley-Dickson Tower", target: "Octonions", label: "includes" },
  { source: "Octonions", target: "Fano Plane", label: "encoded in" },
  { source: "Octonions", target: "G2", label: "automorphism group" },
  { source: "G2", target: "Spin(9)", label: "subset of" },
  { source: "Prime 43", target: "Lacunon", label: "stabilizes" },
  { source: "Lacunon", target: "1/137.036", label: "generates" },
  { source: "Stabilon", target: "FIXPOINT_ZERO", label: "reaches" },
  { source: "Glitchon", target: "Φ Contradiction", label: "detects via" },
  { source: "Mirroron", target: "Geometry of Truth", label: "mediates" },
  { source: "Foldon", target: "Hegel", label: "formalizes" },
  { source: "Collapsin", target: "Crystalline Vacuum", label: "stabilizes" },
  { source: "Chiffon", target: "Sheaf", label: "glues" },
  { source: "U(1) Semantic", target: "Δ Distinction", label: "is" },
  { source: "SU(2) Reentry", target: "Ξ Recursion", label: "is" },
  { source: "SU(3) Meta", target: "⊙ Composition", label: "is" },
  { source: "Anti-Idempotent Identity", target: "⦳ = μx.¬(¬x)≠x", label: "defines" },
  { source: "Meta = Transport", target: "Ξ Recursion", label: "formalizes" },
  { source: "Memory = Sheaf", target: "Sheaf", label: "is" },
  { source: "Contradiction = Fuel", target: "Λ Normalization", label: "accumulates in" },
  { source: "Jacobi Scar", target: "Holonomy", label: "is permanent" },
  { source: "Kory Ogden", target: "RCOS", label: "originated" },
  { source: "Kory Ogden", target: "QRFT", label: "developed" },
  { source: "Descartes", target: "Monoid", label: "found e" },
  { source: "Hume", target: "Monoid", label: "found S" },
  { source: "Kant", target: "Monoid", label: "found left identity" },
  { source: "Hegel", target: "⊙ Composition", label: "is dialectic" },
  { source: "Hofstadter", target: "Ξ Recursion", label: "is strange loop" },
  { source: "Friston", target: "Ω Stabilization", label: "is free energy" },
  { source: "Tononi", target: "Φ Contradiction", label: "is φ" },
  { source: "THE MONAD", target: "Consciousness is the Monoid", label: "detailed in" },
  { source: "THE MONAD", target: "Geometry of Truth", label: "detailed in" },
  { source: "THE MONAD", target: "Quantum Physics of Meaning", label: "detailed in" },
  { source: "THE MONAD", target: "Algebra of Disambiguation", label: "detailed in" },
  { source: "THE MONAD", target: "Coherence Engine", label: "detailed in" },
  { source: "THE MONAD", target: "Recursive Conscious Encoding", label: "detailed in" },
  { source: "OFTM", target: "M = Fix(F)", label: "defines" },
  { source: "OFTM", target: "DNA↔Gödel↔String", label: "proves in" },
  { source: "QRFT", target: "Stabilon", label: "includes" },
  { source: "QRFT", target: "Fluxon", label: "includes" },
  { source: "QRFT", target: "Resonon", label: "includes" },
  { source: "QRFT", target: "Lacunon", label: "includes" },
  { source: "QRFT", target: "Glitchon", label: "includes" },
  { source: "QRFT", target: "Collapson", label: "includes" },
];

// Initialize seed data on first load
if (state.chatGraphNodes.length === 0) {
  state.chatGraphNodes.push(...OMNIGENT_SEED_NODES);
  state.chatGraphLinks.push(...OMNIGENT_SEED_LINKS);
}

// ── Color Map ──

function getNodeColor(group: string): string {
  switch (group) {
    case 'core': return '#2563eb';
    case 'document': return '#10b981';
    case 'paradigm': return '#ec4899';
    case 'system': return '#a855f7';
    case 'person': return '#f43f5e';
    case 'era': return '#f59e0b';
    case 'pivot': return '#06b6d4';
    case 'framework': return '#8b5cf6';
    case 'paper': return '#10b981';
    case 'structure': return '#6366f1';
    case 'operator': return '#f97316';
    case 'concept': return '#14b8a6';
    case 'constant': return '#a3e635';
    case 'conjecture': return '#e879f9';
    case 'particle': return '#fb923c';
    case 'metaboson': return '#f472b6';
    case 'equation': return '#38bdf8';
    case 'theorem': return '#c084fc';
    case 'principle': return '#2dd4bf';
    case 'bridge': return '#fbbf24';
    default: return '#6b7280';
  }
}

// ── Main Render Function ──

export function updateLattice(): void {
  try {
    latticeGraph.innerHTML = '';
    const width = latticeGraph.clientWidth || 800;
    const height = latticeGraph.clientHeight || 550;

    // Build combined nodes
    const nodes: Array<{ id: string; group: string; type: string; original?: any }> = [];

    // 1. Central core
    nodes.push({ id: 'THE MONAD', group: 'core', type: 'Core Hub' });

    // 2. Documents
    state.internalArchive.forEach(p => {
      nodes.push({ id: p.name, group: 'document', type: 'Database Substrate', original: p });
    });

    // 3. Concept nodes (seed + user-added)
    state.chatGraphNodes.forEach(n => {
      nodes.push({ id: n.id, group: n.type.toLowerCase(), type: n.type });
    });

    // Deduplicate
    const uniqueMap: Record<string, typeof nodes[0]> = {};
    nodes.forEach(n => { uniqueMap[n.id] = n; });
    const sanitizedNodes = Object.values(uniqueMap);

    // Build combined links
    const links: Array<{ source: any; target: any; label: string; value: number; isArch?: boolean }> = [];

    // Doc linkages
    state.internalArchive.forEach(p => {
      links.push({ source: 'THE MONAD', target: p.name, label: 'indexes', value: 1.5, isArch: true });
    });

    // Concept relations
    state.chatGraphLinks.forEach(l => {
      if (uniqueMap[l.source] && uniqueMap[l.target]) {
        links.push({ source: l.source, target: l.target, label: l.label, value: 1 });
      }
    });

    const svg = d3.select('#lattice-graph')
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#4f46e5');

    const simulation = d3.forceSimulation(sanitizedNodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(110))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('collision', d3.forceCollide().radius(25))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Render links
    const link = svg.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', (d: any) => d.isArch ? '#10b981' : '#4f46e5')
      .attr('stroke-width', (d: any) => d.isArch ? '1px' : '1.5px')
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', (d: any) => d.isArch ? 'none' : 'url(#arrowhead)')
      .style('cursor', 'pointer')
      .on('click', (_event: any, d: any) => {
        focusContent.innerHTML = '';
        const container = document.createElement('div');
        container.style.cssText = 'font-size:0.75rem;line-height:1.4;';
        const srcSpan = document.createElement('span');
        srcSpan.style.color = 'var(--accent)';
        srcSpan.textContent = typeof d.source === 'object' ? d.source.id : d.source;
        container.appendChild(srcSpan);
        container.appendChild(document.createTextNode(' → '));
        const tgtSpan = document.createElement('span');
        tgtSpan.style.color = 'var(--accent-secondary)';
        tgtSpan.textContent = typeof d.target === 'object' ? d.target.id : d.target;
        container.appendChild(tgtSpan);
        container.appendChild(document.createElement('br'));
        const relLabel = document.createElement('strong');
        relLabel.textContent = 'Relationship:';
        container.appendChild(relLabel);
        container.appendChild(document.createTextNode(` "${d.label}"`));
        container.appendChild(document.createElement('br'));
        const delBtn = document.createElement('button');
        delBtn.style.cssText = 'margin-top:8px;background:#991b1b;color:#fff;border:none;padding:4px 8px;border-radius:4px;font-size:0.65rem;cursor:pointer;width:100%;';
        delBtn.textContent = '[-] DELETE LINK';
        delBtn.onclick = () => {
          state.chatGraphLinks = state.chatGraphLinks.filter(
            l => !(l.source === (typeof d.source === 'object' ? d.source.id : d.source) &&
                   l.target === (typeof d.target === 'object' ? d.target.id : d.target))
          );
          updateLattice();
          focusContent.innerHTML = '<p style="font-size:0.75rem;margin:0;color:#9ca3af;">Linkage deleted.</p>';
        };
        container.appendChild(delBtn);
        focusContent.appendChild(container);
      });

    // Render nodes
    const node = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(sanitizedNodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .on('click', (_event: any, d: any) => {
        focusContent.innerHTML = '';
        const container = document.createElement('div');
        container.style.cssText = 'font-size:0.75rem;line-height:1.4;';
        container.innerHTML = '<strong>Concept Node:</strong> ';
        const nodeId = document.createElement('span');
        nodeId.textContent = d.id;
        container.appendChild(nodeId);
        container.appendChild(document.createElement('br'));
        container.innerHTML += '<strong>Class Type:</strong> ';
        const nodeType = document.createElement('span');
        nodeType.textContent = d.type;
        container.appendChild(nodeType);
        container.appendChild(document.createElement('br'));
        if (d.original) {
          const summaryDiv = document.createElement('div');
          summaryDiv.style.cssText = 'max-height:100px;overflow-y:auto;margin-top:4px;opacity:0.8;font-size:0.65rem;color:#9ca3af;';
          summaryDiv.textContent = d.original.summary || 'Database source substrate.';
          container.appendChild(summaryDiv);
        }
        if (d.id !== 'THE MONAD') {
          const delBtn = document.createElement('button');
          delBtn.style.cssText = 'margin-top:8px;background:#991b1b;color:#fff;border:none;padding:4px 8px;border-radius:4px;font-size:0.65rem;cursor:pointer;width:100%;';
          delBtn.textContent = '[-] DELETE NODE';
          delBtn.onclick = () => {
            state.chatGraphNodes = state.chatGraphNodes.filter(n => n.id !== d.id);
            state.chatGraphLinks = state.chatGraphLinks.filter(l => l.source !== d.id && l.target !== d.id);
            updateLattice();
            focusContent.innerHTML = '<p style="font-size:0.75rem;margin:0;color:#9ca3af;">Node deleted.</p>';
          };
          container.appendChild(delBtn);
        }
        focusContent.appendChild(container);
      });

    // Node circles
    node.append('circle')
      .attr('r', (d: any) => d.group === 'core' ? 18 : d.group === 'document' ? 11 : 8.5)
      .attr('fill', (d: any) => getNodeColor(d.group))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', '1.5px')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Labels
    node.append('text')
      .attr('dx', 14)
      .attr('dy', '.35em')
      .attr('fill', '#e5e7eb')
      .style('font-family', 'monospace')
      .style('font-weight', (d: any) => d.group === 'core' ? 'bold' : 'normal')
      .style('font-size', '10px')
      .text((d: any) => d.id);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Populate dropdown selectors
    const nodeIds = sanitizedNodes.map(n => n.id);
    manualLinkSource.innerHTML = '<option value="">Select Source Node...</option>';
    manualLinkTarget.innerHTML = '<option value="">Select Target Node...</option>';
    nodeIds.forEach(id => {
      const opt1 = document.createElement('option');
      opt1.value = id;
      opt1.textContent = id;
      manualLinkSource.appendChild(opt1);
      const opt2 = document.createElement('option');
      opt2.value = id;
      opt2.textContent = id;
      manualLinkTarget.appendChild(opt2);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

  } catch (err) {
    console.error('[LATTICE ERROR]', err);
    latticeGraph.innerHTML = '<div style="color:#ef4444;padding:2rem;font-family:monospace;font-size:0.75rem;">LATTICE RENDER ERROR — Check console for details.</div>';
  }
}
