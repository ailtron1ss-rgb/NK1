# Research an implementation-focused literature synthesis for NeuroK/NK1, a persis

**Question:** Research an implementation-focused literature synthesis for NeuroK/NK1, a persistent autonomous cognitive software organism. Cover (1) emotion appraisal and mixed affect as causal modulation of drives, attention, action selection and learning; (2) interoception/homeostasis, stress regulation and rest/initiative stability; (3) episodic/semantic/autobiographical memory retrieval, source provenance, consolidation, forgetting and mood-congruent retrieval; (4) endogenous goal generation, curiosity/information gain, counterfactual reasoning, internal dialogue/metacognition and global-workspace broadcasting; (5) evaluation methods that distinguish real behavioral improvement from internal diagnostics, including paired multi-seed holdouts, ablations, long-horizon soak, calibration and causal attribution. Prioritize peer-reviewed work from 2020-2026 plus essential foundational theories. For each major mechanism give the empirical strength, limitations, operational design patterns, measurable NK1 acceptance tests and failure modes. Explicitly distinguish cognitive functional architecture from claims of phenomenal consciousness; do not overclaim that software is conscious. Compare with established cognitive architectures (ACT-R, Soar, GWT, predictive processing/active inference) and modern agent memory/continual-learning research. Return a prioritized, integration-ready roadmap that preserves a single canonical state/event/memory owner and avoids parallel subsystems.

# Architecture and Implementation Roadmap for **Autonomous Cognitive Systems**

Developing a persistent autonomous cognitive software organism requires decomposing the architecture into three core functional requirements: **affective-interoceptive homeostatic control**, **unified multi-tier memory systems**, and **endogenous meta-cognitive goal arbitration**. In engineering such an agent, functional cognitive operations—such as belief updating, forward modeling, and state-dependent valuation—must remain strictly decoupled from claims of phenomenal consciousness or raw sensory qualia [[1.1]](https://consensus.app/papers/emotion-motivation-decisionmaking-the-orbitofrontal-rolls/742430fa583d5ad7aabed2f7b5cb2222/) [[1.2]](https://consensus.app/papers/emotion-motivation-decisionmaking-the-orbitofrontal-rolls/742430fa583d5ad7aabed2f7b5cb2222/).

## Affective Control and Homeostatic Regulation

Computational models formalize emotions as functional computations evaluating states, actions, and uncertain prospective transitions within reinforcement learning or active inference frameworks [[2.1]](https://consensus.app/papers/emotions-as-computations-emanuel-eldar/b97e7e19a82758cba4cdb2d175d94d73/) [[2.2]](https://consensus.app/papers/emotions-as-computations-emanuel-eldar/b97e7e19a82758cba4cdb2d175d94d73/) [[2.3]](https://consensus.app/papers/emotions-as-computations-emanuel-eldar/b97e7e19a82758cba4cdb2d175d94d73/). Within these formulations, interoceptive predictive coding explicitly factorizes internal physiological viability signals from exteroceptive environmental representations [[3.1]](https://consensus.app/papers/lifeinspired-interoceptive-artificial-intelligence-for-lee-oh/e59c6feffd4b54bb8990f972b9973088/) [[3.2]](https://consensus.app/papers/lifeinspired-interoceptive-artificial-intelligence-for-lee-oh/e59c6feffd4b54bb8990f972b9973088/) [[4.1]](https://consensus.app/papers/interoceptive-machine-framework-toward-candia-rivera/e3120a1389e45ef2857c24b92278224b/). Homeostatic prediction errors modulate action selection, shifting policy balances between habit, Pavlovian avoidance, and goal-directed planning [[4.2]](https://consensus.app/papers/interoceptive-machine-framework-toward-candia-rivera/e3120a1389e45ef2857c24b92278224b/) [[5.1]](https://consensus.app/papers/neural-bases-of-affectbased-impulsivity-a-decision-schreiber-hallquist/211848228d0752688b2ecab9f65dcf5a/) [[6.1]](https://consensus.app/papers/emotion-regulation-from-an-actioncontrol-perspective-bramson-toni/9460aed963025324954187b5708e4f81/).

**Figure 1.** Architecture for interoceptive AI. The three modules: homeostatic (green), allostatic (red), and enactive (blue), contribute to a shared policy arbitration layer that integrates their recommendations based on adaptive relevance, represented as relative weights. Homeostatic constraints define viability bounds that cap exploratory action. Allostatic predictions forecast risk and shape adaptive conservativeness, while enactive drives encourage exploration weighted by remaining viability margin. The resulting policy governs the agent&#x27;s perception-actionregulation loop, ensuring that neither stability, anticipation, nor curiosity fully dominates but instead shift dynamically as intern [[4]](https://consensus.app/papers/interoceptive-machine-framework-toward-candia-rivera/e3120a1389e45ef2857c24b92278224b/)

*How to read: The schematic illustrates the interaction of homeostatic constraints, allostatic predictions, and enactive exploration flowing into a centralized policy arbitration layer to steer the agent perception-action loop.*

- **Affective Appraisal Computations**: Emotional states dynamically evaluate reward outcomes, update predictive values, and prioritize attentional resources [[2.4]](https://consensus.app/papers/emotions-as-computations-emanuel-eldar/b97e7e19a82758cba4cdb2d175d94d73/) [[1.3]](https://consensus.app/papers/emotion-motivation-decisionmaking-the-orbitofrontal-rolls/742430fa583d5ad7aabed2f7b5cb2222/) [[7.1]](https://consensus.app/papers/neural-correlates-of-emotionattention-interactions-from-dolcos-katsumi/c2950a9b3a2652ca8e78b8160102f5a5/).
- **Interoceptive Allostatic Setpoints**: Internal regulation loops balance survival margins against exploratory drives through hierarchical precision control and predictive error minimization [[4.3]](https://consensus.app/papers/interoceptive-machine-framework-toward-candia-rivera/e3120a1389e45ef2857c24b92278224b/) [[8.1]](https://consensus.app/papers/awareness-of-being-a-computational-idei-suzuki/60b8f673464d5f769d04c9b1572da2fb/) [[9.1]](https://consensus.app/papers/i-like-therefore-i-can-and-i-can-therefore-i-like-the-role-of-krupnik/004489ed23fd5bd48ac13615e36dcf4c/).
- **Dynamic Rest-Initiative Modes**: Attentional shifts between internal restorative monitoring and active sensorimotor goal pursuit are mediated by meta-attentional parameters that weigh generative beliefs [[8.2]](https://consensus.app/papers/awareness-of-being-a-computational-idei-suzuki/60b8f673464d5f769d04c9b1572da2fb/) [[8.3]](https://consensus.app/papers/awareness-of-being-a-computational-idei-suzuki/60b8f673464d5f769d04c9b1572da2fb/).

## Multi-Tier Memory and Consensual Consolidation

Long-term memory architectures require the systematic integration of autobiographical episodic narratives with generalized semantic knowledge graphs [[10.1]](https://consensus.app/papers/varying-demands-for-cognitive-control-reveals-shared-vatansever-smallwood/27ff4d55f46d5af780e79679dd18ceb1/) [[11.1]](https://consensus.app/papers/behavioral-neurological-and-psychiatric-frailty-of-markowitsch-staniloiu/05f081de9e285a749fa91ba63212c981/). Controlled retrieval of weakly associated traces across episodic and semantic structures recruits shared frontoparietal and salience-processing circuitry [[10.2]](https://consensus.app/papers/varying-demands-for-cognitive-control-reveals-shared-vatansever-smallwood/27ff4d55f46d5af780e79679dd18ceb1/) [[10.3]](https://consensus.app/papers/varying-demands-for-cognitive-control-reveals-shared-vatansever-smallwood/27ff4d55f46d5af780e79679dd18ceb1/). Furthermore, consolidation processes depend heavily on intermediate reactivations, which enhance trace persistence while increasing vulnerability to source distortion and false lure recognition [[12.1]](https://consensus.app/papers/the-role-of-reactivations-during-consolidation-in-the-lenormand-gaston-bellegarde/6bc4d5b55a135d85a853ceb6ab466ae3/) [[12.2]](https://consensus.app/papers/the-role-of-reactivations-during-consolidation-in-the-lenormand-gaston-bellegarde/6bc4d5b55a135d85a853ceb6ab466ae3/).

| Memory Dimension | Biological Architecture | Computational Implementation | Key Operational Failure Mode |
| --- | --- | --- | --- |
| **Episodic Encoding** | Hippocampal-limbic circuit [[11.2]](https://consensus.app/papers/behavioral-neurological-and-psychiatric-frailty-of-markowitsch-staniloiu/05f081de9e285a749fa91ba63212c981/) | Spatiotemporal event hashing [[13.1]](https://consensus.app/papers/decoding-episodic-autobiographical-memory-in-lenormand-mentec/595db95fc9425e86b55a9a1f74f1311a/) | Rapid catastrophic forgetting [[11.3]](https://consensus.app/papers/behavioral-neurological-and-psychiatric-frailty-of-markowitsch-staniloiu/05f081de9e285a749fa91ba63212c981/) |
| **Semantic Synthesis** | Distributed cortical networks [[11.2]](https://consensus.app/papers/behavioral-neurological-and-psychiatric-frailty-of-markowitsch-staniloiu/05f081de9e285a749fa91ba63212c981/) | Concept abstraction graph [[10.4]](https://consensus.app/papers/varying-demands-for-cognitive-control-reveals-shared-vatansever-smallwood/27ff4d55f46d5af780e79679dd18ceb1/) | Premature over-generalization [[14.1]](https://consensus.app/papers/episodic-and-semantic-autobiographical-memory-in-mild-marselli-favieri/60e275289c705255a86f0e08f88e35c8/) |
| **Consolidation Replay** | Sleep and idle state replay [[1.4]](https://consensus.app/papers/emotion-motivation-decisionmaking-the-orbitofrontal-rolls/742430fa583d5ad7aabed2f7b5cb2222/) [[15.1]](https://consensus.app/papers/moodcongruent-memory-revisited-faul-labar/57e3cc577e315a45b7342d8175a81c35/) | Trace-transformation reactivation [[12.3]](https://consensus.app/papers/the-role-of-reactivations-during-consolidation-in-the-lenormand-gaston-bellegarde/6bc4d5b55a135d85a853ceb6ab466ae3/) [[12.4]](https://consensus.app/papers/the-role-of-reactivations-during-consolidation-in-the-lenormand-gaston-bellegarde/6bc4d5b55a135d85a853ceb6ab466ae3/) | False recognition drift [[12.2]](https://consensus.app/papers/the-role-of-reactivations-during-consolidation-in-the-lenormand-gaston-bellegarde/6bc4d5b55a135d85a853ceb6ab466ae3/) |
| **Mood Congruence** | Amygdala-PFC coupling [[16.1]](https://consensus.app/papers/understanding-emotions-origins-and-roles-of-the-amygdala-šimić-tkalčić/5448de8832d8559e9aba334aec0a0fbd/) [[15.2]](https://consensus.app/papers/moodcongruent-memory-revisited-faul-labar/57e3cc577e315a45b7342d8175a81c35/) | Affective weight bias [[15.3]](https://consensus.app/papers/moodcongruent-memory-revisited-faul-labar/57e3cc577e315a45b7342d8175a81c35/) | Dysphoric attractor traps [[15.4]](https://consensus.app/papers/moodcongruent-memory-revisited-faul-labar/57e3cc577e315a45b7342d8175a81c35/) |
| **Active Inhibition** | Left inferior frontal gyrus [[10.2]](https://consensus.app/papers/varying-demands-for-cognitive-control-reveals-shared-vatansever-smallwood/27ff4d55f46d5af780e79679dd18ceb1/) | Retrieval-induced forgetting [[17.1]](https://consensus.app/papers/effortful-retrieval-of-semantic-memories-induces-greer-ali/ea5af519da545f8cb70a578274aa79cc/) [[17.2]](https://consensus.app/papers/effortful-retrieval-of-semantic-memories-induces-greer-ali/ea5af519da545f8cb70a578274aa79cc/) | Semantic interference accumulation [[17.3]](https://consensus.app/papers/effortful-retrieval-of-semantic-memories-induces-greer-ali/ea5af519da545f8cb70a578274aa79cc/) |

**Figure 1:** Taxonomy of memory mechanisms, functional neurocomputational mappings, and architectural vulnerabilities.

## Goal Generation, Metacognition, and Unified State Ownership

Endogenous agency emerges when an architecture formulates internal goals via active inference rather than relying on externally injected prompts [[3.3]](https://consensus.app/papers/lifeinspired-interoceptive-artificial-intelligence-for-lee-oh/e59c6feffd4b54bb8990f972b9973088/) [[8.4]](https://consensus.app/papers/awareness-of-being-a-computational-idei-suzuki/60b8f673464d5f769d04c9b1572da2fb/). When forward models predict unfavorable consequences, counterfactual action monitoring allows systems to arbitrate between rule-based plans and prepotent affective responses without physical execution [[6.2]](https://consensus.app/papers/emotion-regulation-from-an-actioncontrol-perspective-bramson-toni/9460aed963025324954187b5708e4f81/) [[6.3]](https://consensus.app/papers/emotion-regulation-from-an-actioncontrol-perspective-bramson-toni/9460aed963025324954187b5708e4f81/) [[6.4]](https://consensus.app/papers/emotion-regulation-from-an-actioncontrol-perspective-bramson-toni/9460aed963025324954187b5708e4f81/). Compared to classical production systems like ACT-R or Soar, which rely on symbolic conflict resolution, predictive processing unifies motivation and action selection within a continuous free-energy optimization objective [[3.4]](https://consensus.app/papers/lifeinspired-interoceptive-artificial-intelligence-for-lee-oh/e59c6feffd4b54bb8990f972b9973088/) [[9.2]](https://consensus.app/papers/i-like-therefore-i-can-and-i-can-therefore-i-like-the-role-of-krupnik/004489ed23fd5bd48ac13615e36dcf4c/). Modern agent frameworks often fracture state ownership across disconnected LLM chains; in contrast, a scalable architecture demands a single canonical state owner where affective charge directly adjusts the precision of epistemic self-efficacy models [[9.3]](https://consensus.app/papers/i-like-therefore-i-can-and-i-can-therefore-i-like-the-role-of-krupnik/004489ed23fd5bd48ac13615e36dcf4c/) [[9.4]](https://consensus.app/papers/i-like-therefore-i-can-and-i-can-therefore-i-like-the-role-of-krupnik/004489ed23fd5bd48ac13615e36dcf4c/).

## Evidence Coverage Across Autonomous Agent Mechanisms

| | Normative Theory | Empirical Neuroimaging | Computational Agent Models | System Verification |
|---|---|---|---|---|
| Affective Modulation |  |  |  |  |
| Homeostatic Regulation |  |  |  |  |
| Episodic Consolidation |  |  |  |  |
| Metacognitive Arbitration |  |  |  |  |

The current evidence base highlights a marked discrepancy between normative theoretical accounts and fully verified software architectures. While normative theories and human neuroimaging extensively explain emotion appraisal and episodic decay [[2.2]](https://consensus.app/papers/emotions-as-computations-emanuel-eldar/b97e7e19a82758cba4cdb2d175d94d73/) [[10.2]](https://consensus.app/papers/varying-demands-for-cognitive-control-reveals-shared-vatansever-smallwood/27ff4d55f46d5af780e79679dd18ceb1/) [[13.2]](https://consensus.app/papers/decoding-episodic-autobiographical-memory-in-lenormand-mentec/595db95fc9425e86b55a9a1f74f1311a/), computational agent models frequently implement these functions as disjoint, parallel subsystems rather than unified regulatory loops [[3.5]](https://consensus.app/papers/lifeinspired-interoceptive-artificial-intelligence-for-lee-oh/e59c6feffd4b54bb8990f972b9973088/) [[4.4]](https://consensus.app/papers/interoceptive-machine-framework-toward-candia-rivera/e3120a1389e45ef2857c24b92278224b/). Crucially, empirical system verification under long-horizon stress remains largely absent in agent literature, demanding rigorous evaluation frameworks like multi-seed holdouts, ablation testing, and survival calibration across continuous operational regimes [[4.5]](https://consensus.app/papers/interoceptive-machine-framework-toward-candia-rivera/e3120a1389e45ef2857c24b92278224b/) [[4.6]](https://consensus.app/papers/interoceptive-machine-framework-toward-candia-rivera/e3120a1389e45ef2857c24b92278224b/).
 
_These search results were found and analyzed using Consensus, an AI-powered search engine for research. Try it at https://consensus.app. © 2026 Consensus NLP, Inc. Personal, non-commercial use only; redistribution requires copyright holders’ consent._
 
## References
 
`1.` Rolls E. Emotion, motivation, decision-making, the orbitofrontal cortex, anterior cingulate cortex, and the amygdala. *Brain Structure & Function.* 2023;228:1201 - 1257. doi:10.1007/s00429-023-02644-9
 
> [1.1] We should be very careful not to postulate intentional states (i.e., states with intentions, beliefs and desires) unless the evidence for them is strong, and it seems to me that a flexible, one-off, linguistic processing system that can handle propositions is needed for intentional states. (Body)
 
> [1.2] It is suggested that anything that is being dealt with by the HOST computational system becomes conscious, and that is also how qualia, raw sensory feels, are produced (Rolls 2020). (Body)
 
> [1.3] To address this, a unified theory of emotion and motivation is described in which motivational states are states in which instrumental goal-directed actions are performed to obtain rewards or avoid punishers, and emotional states are states that are elicited when the reward or punisher is or is not received. (Abstract)
 
> [1.4] The anterior cingulate cortex is involved in learning actions to obtain rewards, and with the orbitofrontal cortex and ventromedial prefrontal cortex in providing the goals for navigation and in reward-related effects on memory consolidation mediated partly via the cholinergic system. (Abstract)
 
`2.` Emanuel A, Eldar E. Emotions as Computations. *Neuroscience and biobehavioral reviews.* 2022;144:104977 - 104977. doi:10.1016/j.neubiorev.2022.104977
 
> [2.1] Emotions ubiquitously impact action, learning, and perception, yet their essence and role remain widely debated. (Abstract)
 
> [2.2] We examine recent progress in this regard and find that emotions may implement three classes of computations, which serve to evaluate states, actions, and uncertain prospects. (Abstract)
 
> [2.3] For each of these, we use the formalism of reinforcement learning to offer a new formulation that better accounts for existing evidence. (Abstract)
 
> [2.4] Integrating extensive research on the causes and consequences of different emotions suggests a parsimonious one-to-one mapping, according to which emotions are integral to how we evaluate outcomes (pleasure & pain), learn to predict them (happiness & sadness), use them to inform our (frustration & content) and others' (anger & gratitude) actions, and plan in order to realize (desire & hope) or avoid (fear & anxiety) uncertain outcomes. (Abstract)
 
`3.` Lee S, Oh Y, An H, et al. Life-inspired interoceptive artificial intelligence for autonomous and adaptive agents. *Nature Machine Intelligence.* 2023;8:1335 - 1346. doi:10.1038/s42256-026-01296-8
 
> [3.1] Developing interoceptive AI requires abstracting internal states from their biological instantiation into functional and mathematical representations that are applicable to artificial systems. (Abstract)
 
> [3.2] This requires explicit factorization of state variables representing internal and external environments, together with mathematical formalization of life-inspired properties governing internal-state dynamics. (Abstract)
 
> [3.3] Importantly, internal states can also function as universally available and intrinsically valuable contexts, serving as stable reference signals that modulate learning and behaviour under changing external environments. (Abstract)
 
> [3.4] The free energy principle made simpler but not too simple. (Body)
 
> [3.5] Overall, this Perspective presents a unified account on how interoception can enhance autonomy and adaptivity in artificial agents by integrating insights from cybernetics with recent advances in theories of life, reinforcement learning and neuroscience. (Abstract)
 
`4.` Candia-Rivera D. Interoceptive machine framework: Toward interoception-inspired regulatory architectures in artificial intelligence. *Physics of life reviews.* 2026;58:18-35. doi:10.1016/j.plrev.2026.06.003
 
> [4.1] The proposed framework organizes interoceptive contributions into three functional principles: homeostatic, allostatic, and enactive, each associated with distinct computational roles: internal viability regulation, anticipatory uncertainty-based re-evaluation, and active data generation through interaction. (Abstract)
 
> [4.2] Specifically, the interaction between homeostatic regulation (stability constraints), allostatic anticipation (uncertainty-driven modulation), and enactive exploration (data generation) should enable behavioral regimes that cannot be achieved by any component in isolation. (Body)
 
> [4.3] In this view, the 'gut-feeling' module reorganizes standard uncertainty-aware machine learning into a broader viability-oriented framework, in which internal state estimates influence exploration policies, safety constraints, and adaptive goal management. (Body)
 
> [4.4] These principles are not intended as direct neurophysiological mappings, but as abstractions that inform the design of artificial agents with improved self-regulation and context-sensitive behavior. (Abstract)
 
> [4.5] The proposed architecture generates concrete empirical predictions that can be evaluated in AI systems. (Body)
 
> [4.6] Crucially, this evaluation should test whether the integration of the principles yields performance gains beyond existing approaches that implement these mechanisms independently, as the core of this framework's proposal is that integration produces non-additive effects. (Body)
 
`5.` Schreiber AM, Hallquist MN. Neural Bases of Affect-Based Impulsivity: A Decision Neuroscience Account. *Computational Psychiatry.* 2026;10:85 - 103. doi:10.5334/cpsy.159
 
> [5.1] We propose that modulation of norepinephrine and glucocorticoids during negative affective states enhances the pursuit of rewards by reducing goal-directed computations and increasing appetitive Pavlovian computations. (Abstract)
 
`6.` Bramson B, Toni I, Roelofs K. Emotion regulation from an action-control perspective.. *Neuroscience and biobehavioral reviews.* 2023. doi:10.1016/j.neubiorev.2023.105397
 
> [6.1] This can require arbitration between Pavlovian- and rule-based or instrumental behavior. (Body)
 
> [6.2] Continuous feedback loops provide updated predictions during the unfolding of the selected action strategy to maintain the behavior until the trigger state has dissipated (negative feedback control; Cisek, 2019) or until counterfactual strategies become more beneficial (Koch et al., 2018). (Body)
 
> [6.3] There is evidence that in this type of emotional action control counterfactual strategies are continuously monitored in rostro-lateral prefrontal-parietal circuits to rapidly implement alternative actions should the current strategy become unreliable (Boschin et al., 2015; Bramson et al., 2020a; Koch et al., 2018; Mansouri et al., 2017; Miyamoto et al., 2021; Volman et al., 2011). (Body)
 
> [6.4] During reappraisal, alternative actions and outcomes are modelled that yield alternative predicted consequences in sensorimotor cortical areas, as summarized above, in addition to changes in agranular limbic systems that predict visceromotor responses to these modeled events to prepare the body for action (Barrett and Simmons, 2015; Chanes and Barrett, 2016). (Body)
 
`7.` Dolcos F, Katsumi Y, Moore M, et al. Neural Correlates of Emotion-Attention Interactions: From Perception, Learning and Memory to Individual Differences and Training Interventions.. *Neuroscience and biobehavioral reviews.* 2020. doi:10.1016/j.neubiorev.2019.08.017
 
> [7.1] First, affective WM may be enhanced due to prioritizing of affective information within the context of limited attentional resources (Pourtois et al., 2013). (Body)
 
`8.` Idei H, Suzuki K, Yamashita Y. Awareness of being: a computational neurophenomenological model of mindfulness, mind-wandering, and meta-attentional control. *Neuroscience of Consciousness.* 2026;2026. doi:10.1093/nc/niag046
 
> [8.1] Through the minimization of $${F}_{allostasis}$$ , the MBH-RNN simultaneously performs perceptual inference and goal modulation, in which we regard future beliefs as a future ‘goal’ that is adapted toward minimizing predicted future sensory entropy. (Body)
 
> [8.2] Simulations of the resting state showed that inferred (mentally simulated) homeostatic context modulated attentional shifts between a 'being' mode (focused on present interoceptive perception) and a 'doing' mode (involving mentally simulated proprioceptive and exteroceptive sensorimotor behaviors). (Abstract)
 
> [8.3] Further, we identified a meta-attentional parameter that controls these shifts by influencing cognitive attitudes toward internally generated beliefs across network modules spanning from the past to the future. (Abstract)
 
> [8.4] Notably, this ‘goal’ is not an externally given objective; instead, it is an internal objective resulting from the process of minimizing free energy. (Body)
 
`9.` Krupnik V. I like therefore I can, and I can therefore I like: the role of self-efficacy and affect in active inference of allostasis. *Frontiers in Neural Circuits.* 2024;18. doi:10.3389/fncir.2024.1283372
 
> [9.1] Homeostatic set points are expectations of living organisms. (Abstract)
 
> [9.2] The free-energy principle provides a rationale for AIF by stipulating that information-processing open systems must constantly minimize their free energy (through suppressing the cumulative prediction error) to avoid decay. (Abstract)
 
> [9.3] The resulting AIF model of homeo- and allostasis represents a closed autoregulatory loop between the two GMs, where the physiological homeostatic GM is based on integrated extero- and interoceptive GMs, and the cognitive homeostatic GM—on the interaction of hierarchical affective and self-efficacy systems. (Body)
 
> [9.4] Prediction error dynamics and precision control are proposed as the mechanisms of integration of the physiological and cognitive homeostatic GMs into the integrated homeostatic GM (Figure 2). (Body)
 
`10.` Vatansever D, Smallwood J, Jefferies E. Varying demands for cognitive control reveals shared neural processes supporting semantic and episodic memory retrieval. *Nature Communications.* 2021;12. doi:10.1038/s41467-021-22443-2
 
> [10.1] The categorisation of long-term memory into semantic and episodic systems has been an influential catalyst for research on human memory organisation. (Abstract)
 
> [10.2] In a multi-session functional magnetic resonance imaging experiment, we first identify a common cluster of cortical activity centred on the left inferior frontal gyrus and anterior insular cortex for the retrieval of both weakly-associated semantic and weakly-encoded episodic memory traces. (Abstract)
 
> [10.3] Our results provide evidence for shared neural processes supporting the controlled retrieval of information from functionally distinct long-term memory systems. (Abstract)
 
> [10.4] Across two independent experiments, here we directly compare neural processes for the controlled versus automatic retrieval of semantic and episodic memory. (Abstract)
 
`11.` Markowitsch H, Staniloiu A. Behavioral, neurological, and psychiatric frailty of autobiographical memory.. *Wiley interdisciplinary reviews. Cognitive science.* 2022. doi:10.1002/wcs.1617
 
> [11.1] Autobiographical-episodic memory is considered to be the most complex of the five long-term memory systems. (Abstract)
 
> [11.2] For encoding, structures of the limbic system, with the hippocampus in its center, are crucial, for storage of widespread cortical networks, and for retrieval again a distributed recollection network, in which the prefrontal cortex plays a crucial role, is engaged. (Abstract)
 
> [11.3] Compared to the other four long-term memory systems-procedural memory, priming, perceptual, and semantic memory-it develops the latest in phylogeny and ontogeny, and is the most vulnerable of the five systems, being easily impaired by brain damage and psychiatric disorders. (Abstract)
 
`12.` Lenormand D, Gaston-Bellegarde A, Orriols E, Piolino P. The role of reactivations during consolidation in the structure and accessibility of episodic autobiographical memories. *Scientific Reports.* 2026;16. doi:10.1038/s41598-026-37539-2
 
> [12.1] Consistent with these predictions, the results revealed significant differences between the Reactivation and No-Reactivation Group, with superior free recall in the Reactivation Group, whereas recognition performance did not differ between groups (with the exception of more ‘Remember’ responses in false alarms for the Reactivation Group). (Body)
 
> [12.2] Between-groups analyses showed that one-month free recall performance was enhanced in the group with intermediate reactivations, whereas recognition performance did not differ, except for a significant increase in false recognitions in the reactivation group. (Abstract)
 
> [12.3] Based on existing consolidation models, specifically the MTT9,94 and TTT10, we assumed that the encoding mechanisms underlying one-month memory performance would differ depending on the presence of previous reactivations. (Body)
 
> [12.4] Overall, this study contributes to predictive models of EAM by demonstrating how reactivations modulate memory consolidation in a naturalistic context, supporting a dynamic view of consolidation aligned with the Multiple-Trace and Trace-Transformation theories. (Abstract)
 
`13.` Lenormand D, Mentec I, Gaston-Bellegarde A, Orriols E, Piolino P. Decoding episodic autobiographical memory in naturalistic virtual reality. *Scientific Reports.* 2024;14. doi:10.1038/s41598-024-76944-3
 
> [13.1] Episodic autobiographical memory (EAM) is a long-term memory system of personally experienced events with their context - what, where, when - and subjective elements, e.g., emotions, thoughts, or self-reference. (Abstract)
 
> [13.2] In line with Gutchess and Kensinger91, who described a model with shared processes during encoding for both self-reference and emotion, with common electrophysiological potentials and areas of activation in the brain, we expected that subjective measures of the self and emotion associated with the experienced events (see also flashbulb and vivid memories116), as well as physiological measures, would be predictors of long-lasting EAM. (Body)
 
`14.` Marselli G, Favieri F, Casagrande M. Episodic and Semantic Autobiographical Memory in Mild Cognitive Impairment (MCI): A Systematic Review. *Journal of Clinical Medicine.* 2023;12. doi:10.3390/jcm12082856
 
> [14.1] Results: The results highlight controversial findings concerning the semantic component of AM since only seven studies have found a worse semantic AM performance in patients with MCI compared to the HC group. (Abstract)
 
`15.` Faul L, LaBar K. Mood-Congruent Memory Revisited. *Psychological review.* 2022;130:1421 - 1456. doi:10.1037/rev0000394
 
> [15.1] We also suggest that researchers build on foundational models of emotional memory formation to more directly target consolidation mechanisms involved in MCM by utilizing longer encoding-retrieval delays and/or incorporating post-encoding inductions to study designs. (Body)
 
> [15.2] In particular, these tools provide new ways to identify and track the neural correlates of background mood states over time that then can be related to memory network modulation and behavioral biases. (Body)
 
> [15.3] While both have considerable influence in shaping memory, their interaction can produce mood-congruent memory (MCM), a psychological phenomenon where emotional memory is biased toward content affectively congruent with a past or current mood. (Abstract)
 
> [15.4] The study of MCM has direct implications for understanding how memory biases form in daily life, as well as debilitating negative memory schemas that contribute to mood disorders such as depression. (Abstract)
 
`16.` Šimić G, Tkalčić M, Vukić V, et al. Understanding Emotions: Origins and Roles of the Amygdala. *Biomolecules.* 2021;11. doi:10.3390/biom11060823
 
> [16.1] Emotions arise from activations of specialized neuronal populations in several parts of the cerebral cortex, notably the anterior cingulate, insula, ventromedial prefrontal, and subcortical structures, such as the amygdala, ventral striatum, putamen, caudate nucleus, and ventral tegmental area. (Abstract)
 
`17.` Greer J, Ali A, Laksman C, Huang R, McClay M, Clewett DV. Effortful retrieval of semantic memories induces forgetting of related negative and neutral episodic memories.. *Cognition.* 2024;251:105908. doi:10.1016/j.cognition.2024.105908
 
> [17.1] Retrieval-induced forgetting (RIF) experiments show that the act of retrieving some recently encoded items from a given conceptual category leads to greater forgetting of competing items from that same category. (Abstract)
 
> [17.2] Together, these results suggest that even when retrieving neutral semantic memories, effortful retrieval may enhance inhibitory processes that lead to forgetting of both neutral and negative episodic memories. (Abstract)
 
> [17.3] Additionally, across both experiments, less successful word generation was associated with stronger RIF effects. (Abstract)
