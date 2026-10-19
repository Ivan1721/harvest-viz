// Diccionario por área de la interfaz: { 'texto en español': 'traducción' }.
import app from './app.js'
import occlusion from './occlusion.js'
import workload from './workload.js'
import analysis from './analysis.js'

export default { ...app, ...occlusion, ...workload, ...analysis }
