# Metodología — Lumière

## 1. Enfoque

Scrum ligero adaptado a un equipo de una persona (usuario) + asistente IA (Claude Code), priorizando documentación viva sobre ceremonias formales. Se conservan los artefactos que aportan valor real a un proyecto de este tamaño (backlog, definición de terminado, sprints cortos, revisión) y se descartan los que solo tienen sentido con equipos grandes (daily formal, story points de estimación en equipo).

## 2. Artefactos

### 2.1 Backlog de producto
Vive como la lista de módulos en [PROJECT.md](../PROJECT.md) sección 6 ("Orden de construcción"), con estado por módulo (pendiente / en progreso / completado) actualizado en la sección 8 ("Estado actual del proyecto").

### 2.2 Definición de "Terminado" (Definition of Done)
Un módulo se considera terminado cuando cumple **todo** lo siguiente:
1. Código implementado siguiendo la arquitectura definida en [03-arquitectura.md](03-arquitectura.md).
2. Validación de entrada (Zod) en cada endpoint nuevo.
3. Autorización (RBAC) aplicada donde corresponda.
4. Sin secretos ni credenciales hardcodeadas.
5. Pruebas mínimas del flujo crítico del módulo (unitarias y/o de integración según aplique).
6. Documento `.md` del módulo creado/actualizado (`docs/backend/<modulo>.md` o `docs/frontend/<modulo>.md`).
7. `PROJECT.md` sección 8 actualizada (estado y siguiente módulo).
8. Si el módulo introduce cambios de esquema, migración de Prisma generada y aplicada.

### 2.3 Sprints
Cada módulo del roadmap (sección 6 de PROJECT.md) se trata como un sprint corto autocontenido: se entrega como slice vertical completo antes de iniciar el siguiente, salvo dependencias técnicas explícitas (ej. Auth debe existir antes que cualquier flujo que requiera usuario autenticado).

### 2.4 Revisión
Al cerrar cada módulo se hace una revisión breve: qué se construyó, qué decisiones se tomaron y por qué, y qué queda como deuda técnica explícita (registrada en el `.md` del módulo, nunca implícita).

## 3. Notación de diagramas

Todos los diagramas del proyecto se escriben en **Mermaid**, embebidos directamente en los `.md` de `docs/`. Motivo: versionable en git, se renderiza nativamente en GitHub/VS Code/Claude sin herramientas externas, y se mantiene sincronizado con el código porque vive en el mismo repositorio.

Tipos de diagrama usados y dónde:
- **C4 (contexto y contenedores)** → [03-arquitectura.md](03-arquitectura.md)
- **Entidad-Relación** → [04-modelo-datos.md](04-modelo-datos.md)
- **Casos de uso, clases, secuencia** → [05-diagramas-uml.md](05-diagramas-uml.md)

## 4. Convenciones de commits

Se usa el formato [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`) para mantener un historial legible y permitir en el futuro generación automática de changelog.

## 5. Gestión de deuda técnica

Ninguna deuda técnica es implícita. Si se toma un atajo consciente (ej. "dejamos el chatbot de soporte para V2"), se documenta explícitamente en el `.md` del módulo correspondiente y, si aplica, en la sección "Backlog / fuera de alcance" de [01-requerimientos.md](01-requerimientos.md).
