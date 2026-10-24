---
target: modo Simulador
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\projects\\harvest-viz\\src\\workload\\WorkloadApp.jsx"
target_fingerprint: "sha256:f1f08023810684c2c72174180a29a78a373f3daa777307267d833e7beef49bb8"
target_path: "C:\\projects\\harvest-viz\\src\\workload\\WorkloadApp.jsx"
timestamp: 2026-10-23T03-51-00Z
slug: src-workload-workloadapp-jsx
---
Method: dual-agent (A: revisión de diseño · B: detector y navegador). La superposición del detector en el navegador no corrió (el panel bloquea localhost desde https).

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | El punto «modificado» no se enciende para cosecheros, actividad, fila ni disposición (changedSteps solo mira params) |
| 2 | Match System / Real World | 2 | En el Simulador se afirma que las posiciones son reconstruidas y aproximadas (Analysis.jsx:148, DataPanel.jsx:31) |
| 3 | User Control and Freedom | 3 | Restablecer por paso y Cancelar; sin deshacer un campo |
| 4 | Consistency and Standards | 2 | Decimales mezclados (0.49 m junto a 0,66) y duración en s, mm:ss y min |
| 5 | Error Prevention | 3 | Campos validados; motivos de deshabilitado solo en title |
| 6 | Recognition Rather Than Recall | 2 | «30 · 30» explicado en una nota al pie; leyendas solo en title |
| 7 | Flexibility and Efficiency | 2 | Sin atajos de teclado; enlace reproducible muy bueno |
| 8 | Aesthetic and Minimalist Design | 3 | Sobrio; «Simular» a ~1.030 px en una columna de 690 px |
| 9 | Error Recovery | 3 | Mensajes claros; campo inválido solo marcado en rojo |
| 10 | Help and Documentation | 3 | Ayuda rica pero en title, inaccesible por teclado o táctil |
| **Total** | | **26/40** | **Acceptable** |

## Priority Issues
- [P1] El Simulador dice que sus datos son reconstruidos y aproximados (clarify).
- [P1] «Simular» queda bajo el pliegue y no es principal en reposo (layout).
- [P1] El aviso de resultados viejos es incompleto: el punto no ve cfg y la escena vieja se ve vigente (harden).
- [P2] Números y unidades inconsistentes (polish).
- [P2] A 1.024 px la columna derecha desborda y las pestañas se cortan (adapt).

## Deterministic scan
Fuente: 0 hallazgos sin DESIGN.md; 16 avisos design-system-color (paletas de datos, falsos positivos salvo SimPanel.jsx:33). URL: 5 tiny-text (11 px) y overused-font (Inter).
