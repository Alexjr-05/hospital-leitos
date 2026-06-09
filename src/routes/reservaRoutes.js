const express = require('express')
const router = express.Router()
const db = require('../database/db')

/* CRIAR RESERVA */
router.post('/', async (req, res) => {
    const { leito_id, nome_paciente, convenio, medico, previsao_entrada, observacoes } = req.body

    if (!leito_id || !nome_paciente?.trim()) {
        return res.status(400).json({ erro: 'leito_id e nome_paciente são obrigatórios' })
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
            return res.status(400).json({ erro: 'Leito não disponível para reserva' })
        }

        const [result] = await conn.query(
            `INSERT INTO reservas (leito_id, nome_paciente, convenio, medico, previsao_entrada, observacoes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                leito_id,
                nome_paciente.trim(),
                convenio?.trim() || null,
                medico?.trim() || null,
                previsao_entrada || null,
                observacoes?.trim() || null
            ]
        )

        await conn.query(
            "UPDATE leitos SET status = 'Reservado' WHERE id = ?",
            [leito_id]
        )

        await conn.query(
            "INSERT INTO historico_movimentacoes (leito_id, acao, descricao) VALUES (?, 'Reserva', ?)",
            [leito_id, `Leito reservado para ${nome_paciente.trim()}`]
        )

        await conn.commit()
        res.status(201).json({ mensagem: 'Reserva criada com sucesso', id: result.insertId })
    } catch (err) {
        await conn.rollback()
        console.error(err)
        res.status(500).json({ erro: 'Erro ao criar reserva' })
    } finally {
        conn.release()
    }
})

/* CANCELAR RESERVA */
router.put('/:id/cancelar', async (req, res) => {
    const { id } = req.params

    const conn = await db.getConnection()
    try {
        await conn.beginTransaction()

        const [reservas] = await conn.query(
            "SELECT id, leito_id, nome_paciente FROM reservas WHERE id = ? AND status = 'Ativa'",
            [id]
        )
        if (reservas.length === 0) {
            await conn.rollback()
            return res.status(404).json({ erro: 'Reserva não encontrada ou já encerrada' })
        }

        const { leito_id, nome_paciente } = reservas[0]

        await conn.query(
            "UPDATE reservas SET status = 'Cancelada', updated_at = NOW() WHERE id = ?",
            [id]
        )

        await conn.query(
            "UPDATE leitos SET status = 'Disponível' WHERE id = ?",
            [leito_id]
        )

        await conn.query(
            "INSERT INTO historico_movimentacoes (leito_id, acao, descricao) VALUES (?, 'Reserva Cancelada', ?)",
            [leito_id, `Reserva de ${nome_paciente} cancelada`]
        )

        await conn.commit()
        res.json({ mensagem: 'Reserva cancelada com sucesso' })
    } catch (err) {
        await conn.rollback()
        console.error(err)
        res.status(500).json({ erro: 'Erro ao cancelar reserva' })
    } finally {
        conn.release()
    }
})

/* LISTAR RESERVAS ATIVAS */
router.get('/ativas', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT
                r.id,
                l.numero          AS leito_numero,
                s.nome            AS setor,
                r.nome_paciente,
                r.convenio,
                r.medico,
                r.previsao_entrada,
                r.created_at
            FROM reservas r
            JOIN leitos  l ON r.leito_id  = l.id
            JOIN setores s ON l.setor_id  = s.id
            WHERE r.status = 'Ativa'
            ORDER BY r.previsao_entrada ASC, r.created_at ASC
        `)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar reservas' })
    }
})

module.exports = router
