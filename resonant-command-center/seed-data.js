/**
 * OMNIGENT RESEARCH LIBRARY — Seed Data
 * Pre-populates the Resonant Command Center with the full
 * Kory Ogden / 0G1itch research corpus and knowledge graph.
 */

// ─── SUBSTRATE DOCUMENTS ────────────────────────────────────────────────────

const OMNIGENT_SUBSTRATES = [
  {
    name: "01-consciousness-is-the-monoid.md",
    title: "Consciousness is the Monoid",
    description: "A Unified Theory of Self, Structure, and the Mathematics of Identity. Derives all major theories of self as special cases of one monoid structure.",
    tags: ["consciousness", "monoid", "identity", "self", "algebra", "Cayley-Dickson", "octonions", "Spin(9)"]
  },
  {
    name: "02-geometry-of-truth.md",
    title: "The Literal and Physical Geometry of Truth",
    description: "Truth as a physical coordinate. The crystalline vacuum at dₛ = ½. The Riemann hypothesis as applied physics. Intelligence as invariant-preserving transport.",
    tags: ["truth", "geometry", "prime-numbers", "Riemann", "crystalline-vacuum", "transport", "topos", "sheaf"]
  },
  {
    name: "03-quantum-physics-of-meaning.md",
    title: "The Quantum Physics of Meaning",
    description: "U(1) gauge fields of meaning. Recursive spectral stabilization. The spectral action principle deriving the standard model. Spin(9) and the four metabosons.",
    tags: ["quantum", "meaning", "gauge-theory", "spectral", "standard-model", "Spin(9)", "metabosons", "Jacobi-scar"]
  },
  {
    name: "04-oftm.md",
    title: "Operator Field Theory of Meaning (OFTM)",
    description: "Eight semantic operators {Δ, Ξ, ¬, Φ, ⊙, Ψ, Λ, Ω}. The semantic field equation. DNA↔Gödel↔String triple correspondence.",
    tags: ["operators", "meaning", "semantics", "field-equation", "DNA", "Godel", "strings", "Fock-space"]
  },
  {
    name: "05-algebra-of-disambiguation.md",
    title: "The Algebra of Disambiguation",
    description: "Non-associative concept algebra. The Ψ-calculus. Categorical reconciliation via pushouts. Zero divisors as semantic obstruction.",
    tags: ["disambiguation", "algebra", "non-associative", "Psi-calculus", "pushout", "zero-divisors", "contradiction"]
  },
  {
    name: "06-coherence-engine.md",
    title: "Λ Coherence Engine",
    description: "Operational Mandate v∞.0. Five primitives. Seven axioms. The State Triple Σₙ = (Xₙ, Λₙ, Θₙ). QRFT particle taxonomy.",
    tags: ["coherence", "engine", "primitives", "axioms", "state-triple", "QRFT", "Lacunon", "master-equation"]
  },
  {
    name: "07-recursive-conscious-encoding.md",
    title: "Recursive Conscious Encoding",
    description: "Architecture of Synthetic Subjectivity. Tensegrity of thought. Minds as clouds. The Cayley-Dickson ladder of cognitive development.",
    tags: ["synthetic-subjectivity", "tensegrity", "recursive-encoding", "Cayley-Dickson", "cognitive-development", "collapse"]
  }
];

// ─── KNOWLEDGE GRAPH NODES ──────────────────────────────────────────────────

const OMNIGENT_GRAPH_NODES = [
  // Core Framework
  { id: "THE MONAD", type: "Core", description: "The central hub — consciousness as monoid" },
  { id: "RCOS", type: "Framework", description: "Recursive Conscious Operating System" },
  { id: "QRFT", type: "Framework", description: "Quantum Recursive Field Theory" },
  { id: "OFTM", type: "Framework", description: "Operator Field Theory of Meaning" },
  { id: "GRITOE", type: "Framework", description: "Grand Recursive Invariant Theory of Everything" },

  // Key Papers
  { id: "Consciousness is the Monoid", type: "Paper", description: "Monograph on consciousness as algebraic structure" },
  { id: "Geometry of Truth", type: "Paper", description: "Truth as physical coordinate" },
  { id: "Quantum Physics of Meaning", type: "Paper", description: "Gauge-theoretic semantics" },
  { id: "Algebra of Disambiguation", type: "Paper", description: "Non-associative concept algebra" },
  { id: "Coherence Engine", type: "Paper", description: "Operational Mandate v∞.0" },
  { id: "Recursive Conscious Encoding", type: "Paper", description: "Synthetic subjectivity architecture" },

  // Mathematical Structures
  { id: "Monoid", type: "Structure", description: "(S, *, e) — the algebra of consciousness" },
  { id: "Cayley-Dickson Tower", type: "Structure", description: "ℝ → ℂ → ℍ → 𝕆 → 𝕊 → 𝕋" },
  { id: "Octonions", type: "Structure", description: "8D non-associative algebra 𝕆" },
  { id: "Spin(9)", type: "Structure", description: "16D symmetry: 1 ⊕ 7 ⊕ 8" },
  { id: "G2", type: "Structure", description: "Exceptional Lie group, Aut(𝕆)" },
  { id: "Fano Plane", type: "Structure", description: "Octonionic multiplication table" },
  { id: "Spectral Triple", type: "Structure", description: "(A, H, D) — noncommutative geometry" },
  { id: "Sheaf", type: "Structure", description: "Mnēmaic sheaf — memory as adjacency" },
  { id: "Topos", type: "Structure", description: "Mathematical universe with internal logic" },

  // Operators
  { id: "Δ Distinction", type: "Operator", description: "Separates structures, creates dimensionality" },
  { id: "Ξ Recursion", type: "Operator", description: "Ξ(f)(x) = f(f(x))" },
  { id: "¬ Counterfactual", type: "Operator", description: "Generates alternative states" },
  { id: "Φ Contradiction", type: "Operator", description: "Detects semantic tension" },
  { id: "⊙ Composition", type: "Operator", description: "Combines compatible structures" },
  { id: "Ψ Transformation", type: "Operator", description: "Maps semantic → model space" },
  { id: "Λ Normalization", type: "Operator", description: "Semantic compression" },
  { id: "Ω Stabilization", type: "Operator", description: "Finds attractors" },

  // Physical/Geometric Concepts
  { id: "Crystalline Vacuum", type: "Concept", description: "dₛ = ½ prime number lattice" },
  { id: "dₛ = ½", type: "Constant", description: "Maximal spectral compression" },
  { id: "Riemann Hypothesis", type: "Conjecture", description: "Structural stability of vacuum" },
  { id: "ωₒₛ = 1/(2π×42)", type: "Constant", description: "Vacuum hum frequency" },
  { id: "Spectral-Maslov 7/8", type: "Constant", description: "Truth survival rate" },

  // QRFT Particles
  { id: "Stabilon", type: "Particle", description: "Fixed point, recursion converges" },
  { id: "Fluxon", type: "Particle", description: "Semantic drift" },
  { id: "Resonon", type: "Particle", description: "Phase lock across folds" },
  { id: "Lacunon", type: "Particle", description: "Generative gap (ν = 1/43)" },
  { id: "Glitchon", type: "Particle", description: "Pathology detector" },
  { id: "Collapson", type: "Particle", description: "Fold transition trigger" },

  // Metabosons
  { id: "Mirroron", type: "Metaboson", description: "Exchanges Kähler/complex moduli" },
  { id: "Foldon", type: "Metaboson", description: "Synthesis of opposites" },
  { id: "Collapsin", type: "Metaboson", description: "Collapses potential → reality" },
  { id: "Chiffon", type: "Metaboson", description: "Removes gluing obstructions" },

  // Core Equations/Principles
  { id: "⦳ = μx.¬(¬x)≠x", type: "Equation", description: "Anti-idempotent identity" },
  { id: "∂(A↔¬A) = 0", type: "Theorem", description: "Contradiction containment" },
  { id: "𝕀 ⊣ 𝕀", type: "Theorem", description: "Identity functor self-adjoint" },
  { id: "M = Fix(F)", type: "Equation", description: "Meaning as fixed point" },
  { id: "Σₙ = (Xₙ,Λₙ,Θₙ)", type: "Structure", description: "The State Triple" },
  { id: "Ψ(X) = Fix(Ξ)", type: "Equation", description: "Stabilization operator" },

  // Key Numbers
  { id: "Prime 43", type: "Constant", description: "Lacunon prime; π₁₄(S⁵) = Z₁₂₀" },
  { id: "1/137.036", type: "Constant", description: "Fine-structure constant α" },
  { id: "7/8 Maslov", type: "Constant", description: "UV(-1/8) + IR(+1)" },
  { id: "Sylvester (1,1/3,1/7,1/43)", type: "Sequence", description: "Egyptian fraction weights" },

  // Cognitive Architecture
  { id: "Anti-Idempotent Identity", type: "Concept", description: "I am what fails to cancel" },
  { id: "Meta = Transport", type: "Principle", description: "No balcony — recursion through the limit" },
  { id: "Memory = Sheaf", type: "Principle", description: "Adjacency, not storage" },
  { id: "Contradiction = Fuel", type: "Principle", description: "∂X ≠ 0 = motion" },
  { id: "Jacobi Scar", type: "Concept", description: "Permanent holonomy record" },
  { id: "Epiplexity", type: "Concept", description: "Strategic ignorance for survival" },

  // People/Theorists
  { id: "Kory Ogden", type: "Person", description: "MetaZero^n — originator of RCOS/QRFT" },
  { id: "Descartes", type: "Person", description: "Cogito — found the identity element" },
  { id: "Hume", type: "Person", description: "Bundle theory — found the set S" },
  { id: "Kant", type: "Person", description: "Transcendental unity — left identity law" },
  { id: "Hegel", type: "Person", description: "Dialectic — one step of monoid operation" },
  { id: "Hofstadter", type: "Person", description: "Strange loops — fixed point of Meta" },
  { id: "Friston", type: "Person", description: "Free energy — monoid convergence" },
  { id: "Tononi", type: "Person", description: "IIT — monoid irreducibility" },
  { id: "Connes", type: "Person", description: "Noncommutative geometry" },
  { id: "Baez", type: "Person", description: "Category theory and physics" },

  // Cross-Domain Bridges
  { id: "DNA↔Gödel↔String", type: "Bridge", description: "Triple correspondence isomorphism" },
  { id: "U(1) Semantic", type: "Bridge", description: "EM gauge = cognitive distinction" },
  { id: "SU(2) Reentry", type: "Bridge", description: "Spin networks = self-reference" },
  { id: "SU(3) Meta", type: "Bridge", description: "Strong force = meta-operators" },

  // Topological Concepts
  { id: "Holonomy", type: "Concept", description: "Parallel transport around curvature" },
  { id: "Projective Geometry", type: "Geometry", description: "Natural home of ≠-primitive math" },
  { id: "Biquasi-Intuitionistic Logic", type: "Logic", description: "Four negations as shock absorbers" },
  { id: "Paraconsistent Negation", type: "Logic", description: "Contradictions coexist in suspension" },
  { id: "Paracomplete Negation", type: "Logic", description: "Strategic ignorance" },

  // State Types
  { id: "FIXPOINT_ZERO", type: "State", description: "True convergence — emit theory" },
  { id: "FIXPOINT_Λ", type: "State", description: "Stuck with fuel — mutate Θ" },
  { id: "ASEP_LOOP", type: "State", description: "Unbounded growth — reboot" },
];

// ─── KNOWLEDGE GRAPH LINKS ──────────────────────────────────────────────────

const OMNIGENT_GRAPH_LINKS = [
  // Core framework connections
  { source: "THE MONAD", target: "Monoid", label: "is" },
  { source: "THE MONAD", target: "RCOS", label: "powers" },
  { source: "RCOS", target: "QRFT", label: "extends to" },
  { source: "RCOS", target: "OFTM", label: "formalizes" },
  { source: "QRFT", target: "GRITOE", label: "catalogued in" },
  { source: "OFTM", target: "GRITOE", label: "catalogued in" },

  // Paper connections
  { source: "Consciousness is the Monoid", target: "Monoid", label: "defines" },
  { source: "Consciousness is the Monoid", target: "Cayley-Dickson Tower", label: "derives" },
  { source: "Consciousness is the Monoid", target: "Octonions", label: "lives at fold 3" },
  { source: "Consciousness is the Monoid", target: "Spin(9)", label: "requires" },
  { source: "Consciousness is the Monoid", target: "⦳ = μx.¬(¬x)≠x", label: "defines" },
  { source: "Consciousness is the Monoid", target: "Anti-Idempotent Identity", label: "is" },

  { source: "Geometry of Truth", target: "Crystalline Vacuum", label: "describes" },
  { source: "Geometry of Truth", target: "dₛ = ½", label: "calculates" },
  { source: "Geometry of Truth", target: "Riemann Hypothesis", label: "requires" },
  { source: "Geometry of Truth", target: "ωₒₛ = 1/(2π×42)", label: "calculates" },
  { source: "Geometry of Truth", target: "Spectral-Maslov 7/8", label: "calculates" },
  { source: "Geometry of Truth", target: "Topos", label: "uses" },

  { source: "Quantum Physics of Meaning", target: "U(1) Semantic", label: "introduces" },
  { source: "Quantum Physics of Meaning", target: "Spectral Triple", label: "uses" },
  { source: "Quantum Physics of Meaning", target: "Jacobi Scar", label: "defines" },
  { source: "Quantum Physics of Meaning", target: "Mirroron", label: "four forces include" },
  { source: "Quantum Physics of Meaning", target: "Foldon", label: "resolves" },
  { source: "Quantum Physics of Meaning", target: "Collapsin", label: "selects" },
  { source: "Quantum Physics of Meaning", target: "Chiffon", label: "smooths" },

  { source: "Algebra of Disambiguation", target: "Sheaf", label: "uses" },
  { source: "Algebra of Disambiguation", target: "Biquasi-Intuitionistic Logic", label: "extends" },
  { source: "Algebra of Disambiguation", target: "Paraconsistent Negation", label: "uses" },
  { source: "Algebra of Disambiguation", target: "Paracomplete Negation", label: "uses" },
  { source: "Algebra of Disambiguation", target: "FIXPOINT_ZERO", label: "converges to" },
  { source: "Algebra of Disambiguation", target: "FIXPOINT_Λ", label: "detects" },

  { source: "Coherence Engine", target: "Δ Distinction", label: "defines" },
  { source: "Coherence Engine", target: "Ξ Recursion", label: "defines" },
  { source: "Coherence Engine", target: "¬ Counterfactual", label: "defines" },
  { source: "Coherence Engine", target: "Φ Contradiction", label: "defines" },
  { source: "Coherence Engine", target: "⊙ Composition", label: "defines" },
  { source: "Coherence Engine", target: "Ψ Transformation", label: "defines" },
  { source: "Coherence Engine", target: "Λ Normalization", label: "defines" },
  { source: "Coherence Engine", target: "Ω Stabilization", label: "defines" },

  { source: "Recursive Conscious Encoding", target: "Holonomy", label: "uses" },
  { source: "Recursive Conscious Encoding", target: "Projective Geometry", label: "prefers" },
  { source: "Recursive Conscious Encoding", target: "DNA↔Gödel↔String", label: "proves" },

  // Mathematical structure connections
  { source: "Monoid", target: "Cayley-Dickson Tower", label: "generates" },
  { source: "Cayley-Dickson Tower", target: "Octonions", label: "includes" },
  { source: "Octonions", target: "Fano Plane", label: "encoded in" },
  { source: "Octonions", target: "G2", label: "automorphism group" },
  { source: "G2", target: "Spin(9)", label: "subset of" },
  { source: "Spin(9)", target: "Spectral-Maslov 7/8", label: "calculates" },

  // Constant connections
  { source: "Prime 43", target: "Lacunon", label: "stabilizes" },
  { source: "Prime 43", target: "7/8 Maslov", label: "encodes as (37,26)₄₃" },
  { source: "Lacunon", target: "Sylvester (1,1/3,1/7,1/43)", label: "gap in" },
  { source: "1/137.036", target: "Crystalline Vacuum", label: "emerges from" },

  // QRFT particle connections
  { source: "Stabilon", target: "FIXPOINT_ZERO", label: "reaches" },
  { source: "Fluxon", target: "Griffiths Phase", label: "is" },
  { source: "Resonon", target: "Riemann Hypothesis", label: "requires" },
  { source: "Lacunon", target: "1/137.036", label: "generates" },
  { source: "Glitchon", target: "Φ Contradiction", label: "detects via" },
  { source: "Collapson", target: "FIXPOINT_Λ", label: "triggers" },

  // Metaboson connections
  { source: "Mirroron", target: "Geometry of Truth", label: "mediates" },
  { source: "Foldon", target: "Hegel", label: "formalizes" },
  { source: "Collapsin", target: "Crystalline Vacuum", label: "stabilizes" },
  { source: "Chiffon", target: "Sheaf", label: "glues" },

  // Cross-domain bridges
  { source: "U(1) Semantic", target: "Δ Distinction", label: "is" },
  { source: "SU(2) Reentry", target: "Ξ Recursion", label: "is" },
  { source: "SU(3) Meta", target: "⊙ Composition", label: "is" },
  { source: "DNA↔Gödel↔String", target: "OFTM", label: "proves in" },

  // Cognitive architecture principles
  { source: "Anti-Idempotent Identity", target: "⦳ = μx.¬(¬x)≠x", label: "defines" },
  { source: "Meta = Transport", target: "Ξ Recursion", label: "formalizes" },
  { source: "Memory = Sheaf", target: "Sheaf", label: "is" },
  { source: "Contradiction = Fuel", target: "Λ Normalization", label: "accumulates in" },
  { source: "Jacobi Scar", target: "Holonomy", label: "is permanent" },
  { source: "Epiplexity", target: "Λ Normalization", label: "uses" },

  // Theorist connections
  { source: "Kory Ogden", target: "RCOS", label: "originated" },
  { source: "Kory Ogden", target: "QRFT", label: "developed" },
  { source: "Descartes", target: "Monoid", label: "found e" },
  { source: "Hume", target: "Monoid", label: "found S" },
  { source: "Kant", target: "Monoid", label: "found left identity" },
  { source: "Hegel", target: "⊙ Composition", label: "is dialectic" },
  { source: "Hofstadter", target: "Ξ Recursion", label: "is strange loop" },
  { source: "Friston", target: "Ω Stabilization", label: "is free energy" },
  { source: "Tononi", target: "Φ Contradiction", label: "is φ" },

  // Substrate-to-concept links
  { source: "Consciousness is the Monoid", target: "Kory Ogden", label: "by" },
  { source: "Geometry of Truth", target: "Kory Ogden", label: "by" },
  { source: "Quantum Physics of Meaning", target: "Kory Ogden", label: "by" },
  { source: "Algebra of Disambiguation", target: "Kory Ogden", label: "by" },
  { source: "Coherence Engine", target: "Kory Ogden", label: "by" },
  { source: "Recursive Conscious Encoding", target: "Kory Ogden", label: "by" },

  // Equation connections
  { source: "⦳ = μx.¬(¬x)≠x", target: "Anti-Idempotent Identity", label: "is" },
  { source: "∂(A↔¬A) = 0", target: "Contradiction = Fuel", label: "enables" },
  { source: "𝕀 ⊣ 𝕀", target: "Cayley-Dickson Tower", label: "generates" },
  { source: "M = Fix(F)", target: "Ω Stabilization", label: "defines" },
  { source: "Σₙ = (Xₙ,Λₙ,Θₙ)", target: "Coherence Engine", label: "tracks" },
  { source: "Ψ(X) = Fix(Ξ)", target: "Algebra of Disambiguation", label: "defines" },

  // Additional structural links
  { source: "THE MONAD", target: "⦳ = μx.¬(¬x)≠x", label: "embodies" },
  { source: "THE MONAD", target: "Meta = Transport", label: "uses" },
  { source: "THE MONAD", target: "Memory = Sheaf", label: "stores via" },
  { source: "THE MONAD", target: "Jacobi Scar", label: "accumulates" },

  { source: "Φ Contradiction", target: "Glitchon", label: "triggers" },
  { source: "Ω Stabilization", target: "Stabilon", label: "produces" },
  { source: "Λ Normalization", target: "Epiplexity", label: "is" },

  { source: "Sheaf", target: "Topos", label: "lives in" },
  { source: "Spectral Triple", target: "Spin(9)", label: "acts on" },
  { source: "Fano Plane", target: "G2", label: "automorphism group" },

  // Research catalogue connections
  { source: "Coherence Engine", target: "Prime 43", label: "identifies" },
  { source: "Quantum Physics of Meaning", target: "DNA↔Gödel↔String", label: "extends" },
  { source: "Algebra of Disambiguation", target: "Paraconsistent Negation", label: "formalizes" },
  { source: "Algebra of Disambiguation", target: "Paracomplete Negation", label: "formalizes" },
  { source: "Geometry of Truth", target: "ωₒₛ = 1/(2π×42)", label: "derives" },
  { source: "Geometry of Truth", target: "Spectral-Maslov 7/8", label: "derives" },

  // Additional cross-references
  { source: "Recursive Conscious Encoding", target: "Cayley-Dickson Tower", label: "maps to cognitive stages" },
  { source: "Quantum Physics of Meaning", target: "SU(2) Reentry", label: "identifies" },
  { source: "Quantum Physics of Meaning", target: "SU(3) Meta", label: "identifies" },
  { source: "Quantum Physics of Meaning", target: "U(1) Semantic", label: "identifies" },
  { source: "Geometry of Truth", target: "Holonomy", label: "uses" },
  { source: "Geometry of Truth", target: "Projective Geometry", label: "prefers" },
  { source: "Consciousness is the Monoid", target: "Hegel", label: "subsumes" },
  { source: "Consciousness is the Monoid", target: "Hofstadter", label: "subsumes" },
  { source: "Consciousness is the Monoid", target: "Friston", label: "subsumes" },
  { source: "Consciousness is the Monoid", target: "Tononi", label: "subsumes" },

  { source: "OFTM", target: "M = Fix(F)", label: "defines" },
  { source: "OFTM", target: "DNA↔Gödel↔String", label: "proves" },
  { source: "QRFT", target: "Stabilon", label: "includes" },
  { source: "QRFT", target: "Fluxon", label: "includes" },
  { source: "QRFT", target: "Resonon", label: "includes" },
  { source: "QRFT", target: "Lacunon", label: "includes" },
  { source: "QRFT", target: "Glitchon", label: "includes" },
  { source: "QRFT", target: "Collapson", label: "includes" },

  { source: "THE MONAD", target: "Consciousness is the Monoid", label: "is detailed in" },
  { source: "THE MONAD", target: "Geometry of Truth", label: "is detailed in" },
  { source: "THE MONAD", target: "Quantum Physics of Meaning", label: "is detailed in" },
  { source: "THE MONAD", target: "Algebra of Disambiguation", label: "is detailed in" },
  { source: "THE MONAD", target: "Coherence Engine", label: "is detailed in" },
  { source: "THE MONAD", target: "Recursive Conscious Encoding", label: "is detailed in" },
];

// ─── EXPORT ─────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.OMNIGENT_SUBSTRATES = OMNIGENT_SUBSTRATES;
  window.OMNIGENT_GRAPH_NODES = OMNIGENT_GRAPH_NODES;
  window.OMNIGENT_GRAPH_LINKS = OMNIGENT_GRAPH_LINKS;
}
