# V94 Research Ledger

## 1. Loss of plasticity / Continual Backpropagation
- Nature 2024: https://www.nature.com/articles/s41586-024-07711-7
- CCBP ICLR 2026 paper: https://openreview.net/pdf/bc5315b38fd0e0f1e120a6841884ab9b5219e107.pdf
- CCBP PyTorch: https://github.com/lucidrains/ccbp-pytorch
- Status: used as design reference for the neuronal lifecycle controller.

## 2. Self-Normalized Resets
- ICLR 2025: https://proceedings.iclr.cc/paper_files/paper/2025/hash/359c0c4dc53b6bf64041b4c8334f1c11-Abstract-Conference.html
- Official source: https://github.com/ajozefiak/SelfNormalizedResets
- Status: used to motivate evidence-based low-activity reset eligibility.

## 3. Homeostatic regulation
- Scientific Reports 2025: https://www.nature.com/articles/s41598-025-09114-8
- Status: design reference only; current NeuroCore homeostatic gain is an independent lightweight mechanism.

## 4. Decision
The mechanism is not promoted to default current because the available qualification data are not yet strong enough and one long seed was negative.

## Fresh 2026 sources
- Hernandez-Garcia et al., "Reinitializing weights vs units for maintaining plasticity in neural networks", LLA 2026: https://proceedings.mlr.press/v330/hernandez-garcia26a.html
- Rohani et al., "Preserving Plasticity in Continual Learning with Adaptive Linearity Injection", LLA 2026: https://proceedings.mlr.press/v330/rohani26a.html
- AdaLin source: https://github.com/RoozbehRazavi/AdaLin
