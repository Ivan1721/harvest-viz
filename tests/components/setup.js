// Las pruebas de componentes necesitan la versión de desarrollo de React (act, mensajes de error).
// Si NODE_ENV=production está definido en el sistema, React cargaría su versión de producción.
process.env.NODE_ENV = 'test'
