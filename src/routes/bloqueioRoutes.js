const express = require('express')
const router = express.Router()
const db = require('../database/db')

const MOTIVOS_VALIDOS = ['Manutenção', 'Isolamento', 'Reforma', 'Equipamento']

/* BLOQUEAR LEITO */
router.post('/', async (req, res) => {
    const { leito_id, motivo, descricao, responsavel } = req.body

    if (!leito_id || !motivo || !responsavel?.trim()) {
        return res.status(400).json({ erro: 'leito_id, motivo e responsavel são obrigatórios' })
    }

    if (!MOTIVOS_VALIDOS.includes(motivo)) {
        return res.status(400).json({ erro: `Motivo inválido. Use: ${MOTIVOS_VALIDOS.join(', ')}` })
    }

    const conn = await db.getConnection()
    try {
        await conn.beginTransaction()

        const [leitos] = await conn.query(
            "SELECT id FROM leitos WHERE id = ? AND status = 'Disponível'",
            [leito_id]
        )
        if (leitos.length === 0) {
            await conn.rollback()
            return res.status(400).json({ erro: 'Leito não disponível para bloqueio' })
        }

        const [result] = await conn.query(
            'INSERT INTO bloqueios (leito_id, motivo, descricao, responsavel) VALUES (?, ?, ?, ?)',
            [leito_id, motivo, descricao?.trim() || null, responsavel.trim()]
        )

        await conn.query(
            "UPDATE leitos SET status = 'Bloqueado' WHERE id = ?",
            [leito_id]
        )

        await conn.query(
            "INSERT INTO historico_movimentacoes (leito_id, acao, descricao) VALUES (?, 'Bloqueio', ?)",
            [leito_id, `Leito bloqueado por ${motivo}: ${descricao?.trim() || 'sem descrição'}. Responsável: ${responsavel.trim()}`]
        )

        await conn.commit()
        res.status(201).json({ mensagem: 'Leito bloqueado com sucesso', id: result.insertId })
    } catch (err) {
        await conn.rollback()
        console.error(err)
        res.status(500).json({ erro: 'Erro ao bloquear leito' })
    } finally {
        conn.release()
    }
})

/* DESBLOQUEAR LEITO */
router.put('/:id/desbloquear', async (req, res) => {
    const { id } = req.params

    const conn = await db.getConnection()
    try {
        await conn.beginTransaction()

        const [bloqueios] = await conn.query(
            "SELECT id, leito_id FROM bloqueios WHERE id = ? AND status = 'Ativo'",
            [id]
        )
        if (bloqueios.length === 0) {
            await conn.rollback()
            return res.status(404).json({ erro: 'Bloqueio não encontrado ou já encerrado' })
        }

        const { leito_id } = bloqueios[0]

        await conn.query(
            "UPDATE bloqueios SET fim = NOW(), status = 'Encerrado' WHERE id = ?",
            [id]
        )

        await conn.query(
            "UPDATE leitos SET status = 'Disponível' WHERE id = ?",
            [leito_id]
        )

        await conn.query(
            "INSERT INTO historico_movimentacoes (leito_id, acao, descricao) VALUES (?, 'Desbloqueio', 'Leito desbloqueado e disponibilizado')",
            [leito_id]
        )

        await conn.commit()
        res.json({ mensagem: 'Leito desbloqueado com sucesso' })
    } catch (err) {
        await conn.rollback()
        console.error(err)
        res.status(500).json({ erro: 'Erro ao desbloquear leito' })
    } finally {
        conn.release()
    }
})

/* LISTAR BLOQUEIOS ATIVOS */
router.get('/ativos', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT
                b.id,
                l.numero     AS leito_numero,
                s.nome       AS setor,
                b.motivo,
                b.descricao,
                b.responsavel,
                b.inicio
            FROM bloqueios b
            JOIN leitos  l ON b.leito_id  = l.id
            JOIN setores s ON l.setor_id  = s.id
            WHERE b.status = 'Ativo'
            ORDER BY b.inicio
        `)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar bloqueios' })
    }
})

module.exports = router
