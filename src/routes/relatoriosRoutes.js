const express = require('express')
const router = express.Router()
const db = require('../database/db')

/* KPIs DO DASHBOARD */
router.get('/kpis', async (req, res) => {
    try {
        const [[kpis]] = await db.query(`
            SELECT
                COUNT(*)                                                            AS total,
                SUM(status = 'Disponível')                                         AS disponiveis,
                SUM(status = 'Ocupado')                                            AS ocupados,
                SUM(status = 'Higienização')                                       AS em_higienizacao,
                SUM(status = 'Reservado')                                          AS reservados,
                SUM(status = 'Bloqueado')                                          AS bloqueados,
                ROUND(SUM(status = 'Ocupado') * 100.0 / NULLIF(COUNT(*), 0), 1)  AS taxa_ocupacao
            FROM leitos
        `)
        res.json(kpis)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar KPIs' })
    }
})

/* ALERTAS OPERACIONAIS */
router.get('/alertas', async (req, res) => {
    try {
        const [[dados]] = await db.query(`
            SELECT
                COUNT(*)                        AS total,
                SUM(status = 'Ocupado')         AS ocupados,
                SUM(status = 'Higienização')    AS em_higienizacao,
                SUM(status = 'Reservado')       AS reservados
            FROM leitos
        `)

        const { total, ocupados, em_higienizacao, reservados } = dados
        const taxa = total > 0 ? (Number(ocupados) / Number(total)) * 100 : 0

        const alertas = []

        if (taxa >= 95) {
            alertas.push({ nivel: 'danger', mensagem: `Ocupação crítica: ${taxa.toFixed(1)}% — Capacidade quase esgotada` })
        } else if (taxa >= 85) {
            alertas.push({ nivel: 'warning', mensagem: `Ocupação elevada: ${taxa.toFixed(1)}% — Atenção à disponibilidade de leitos` })
        }

        if (Number(em_higienizacao) >= 10) {
            alertas.push({ nivel: 'warning', mensagem: `${em_higienizacao} leitos em higienização — Verificar processo de limpeza` })
        }

        if (Number(reservados) >= 5) {
            alertas.push({ nivel: 'warning', mensagem: `${reservados} pacientes aguardando leito (reservas ativas)` })
        }

        res.json({ alertas })
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar alertas' })
    }
})

/* TAXA DE OCUPAÇÃO POR SETOR (Power BI) */
router.get('/taxa-ocupacao', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT
                s.nome                                                                              AS setor,
                COUNT(l.id)                                                                        AS total_leitos,
                SUM(l.status = 'Ocupado')                                                          AS ocupados,
                SUM(l.status = 'Disponível')                                                       AS disponiveis,
                SUM(l.status = 'Higienização')                                                     AS em_higienizacao,
                SUM(l.status = 'Reservado')                                                        AS reservados,
                SUM(l.status = 'Bloqueado')                                                        AS bloqueados,
                ROUND(SUM(l.status = 'Ocupado') * 100.0 / NULLIF(COUNT(l.id), 0), 1)             AS taxa_ocupacao_pct
            FROM leitos l
            JOIN setores s ON l.setor_id = s.id
            GROUP BY s.id, s.nome
            ORDER BY taxa_ocupacao_pct DESC
        `)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar taxa de ocupação' })
    }
})

/* ALTAS POR DIA — últimos 30 dias (Power BI) */
router.get('/altas-por-dia', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT
                DATE(data_saida)    AS data,
                COUNT(*)            AS total_altas
            FROM internacoes
            WHERE status = 'Alta'
              AND data_saida >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(data_saida)
            ORDER BY data ASC
        `)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar altas por dia' })
    }
})

/* INTERNAÇÕES POR SETOR (Power BI) */
router.get('/internacoes-por-setor', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT
                s.nome                          AS setor,
                COUNT(i.id)                     AS total_internacoes,
                SUM(i.status = 'Ativa')         AS internacoes_ativas,
                SUM(i.status = 'Alta')          AS internacoes_com_alta
            FROM internacoes i
            JOIN leitos  l ON i.leito_id  = l.id
            JOIN setores s ON l.setor_id  = s.id
            GROUP BY s.id, s.nome
            ORDER BY total_internacoes DESC
        `)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar internações por setor' })
    }
})

/* TEMPO MÉDIO DE PERMANÊNCIA (Power BI) */
router.get('/tempo-medio-permanencia', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT
                s.nome                                                                                AS setor,
                COUNT(i.id)                                                                          AS total_internacoes,
                ROUND(AVG(DATEDIFF(COALESCE(i.data_saida, NOW()), i.data_entrada)), 1)              AS media_dias,
                MIN(DATEDIFF(COALESCE(i.data_saida, NOW()), i.data_entrada))                        AS min_dias,
                MAX(DATEDIFF(COALESCE(i.data_saida, NOW()), i.data_entrada))                        AS max_dias
            FROM internacoes i
            JOIN leitos  l ON i.leito_id  = l.id
            JOIN setores s ON l.setor_id  = s.id
            GROUP BY s.id, s.nome
            ORDER BY media_dias DESC
        `)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar tempo médio de permanência' })
    }
})

/* GIRO DE LEITO — internações por leito nos últimos 30 dias (Power BI) */
router.get('/giro-leito', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT
                s.nome                                                                              AS setor,
                COUNT(DISTINCT l.id)                                                               AS total_leitos,
                COUNT(i.id)                                                                        AS internacoes_30_dias,
                ROUND(COUNT(i.id) / NULLIF(COUNT(DISTINCT l.id), 0), 2)                           AS giro_por_leito
            FROM leitos l
            JOIN setores s ON l.setor_id = s.id
            LEFT JOIN internacoes i ON i.leito_id = l.id
                AND i.data_entrada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY s.id, s.nome
            ORDER BY giro_por_leito DESC
        `)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar giro de leito' })
    }
})

/* TEMPO MÉDIO DE HIGIENIZAÇÃO (Power BI) */
router.get('/tempo-medio-higienizacao', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT
                s.nome                                                                              AS setor,
                COUNT(h.id)                                                                        AS total_higienizacoes,
                ROUND(AVG(TIMESTAMPDIFF(MINUTE, h.inicio, h.fim)), 0)                             AS media_minutos,
                MIN(TIMESTAMPDIFF(MINUTE, h.inicio, h.fim))                                       AS min_minutos,
                MAX(TIMESTAMPDIFF(MINUTE, h.inicio, h.fim))                                       AS max_minutos
            FROM higienizacoes h
            JOIN leitos  l ON h.leito_id  = l.id
            JOIN setores s ON l.setor_id  = s.id
            WHERE h.status = 'Concluída' AND h.fim IS NOT NULL
            GROUP BY s.id, s.nome
            ORDER BY media_minutos DESC
        `)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar tempo de higienização' })
    }
})

module.exports = router
