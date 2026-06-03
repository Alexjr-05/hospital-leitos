const express = require('express')
const router = express.Router()
const db = require('../database/db')

/* INTERNAR PACIENTE */
router.post('/', async (req, res) => {
    const { nome, prontuario, data_nascimento, convenio, medico_responsavel, leito_id } = req.body

    if (!nome || !prontuario || !data_nascimento || !convenio || !medico_responsavel || !leito_id) {
        return res.status(400).json({ erro: 'Todos os campos são obrigatórios' })
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(data_nascimento)) {
        return res.status(400).json({ erro: 'Data de nascimento inválida. Use o formato AAAA-MM-DD' })
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
            return res.status(400).json({ erro: 'Leito não disponível ou não encontrado' })
        }

        const [resultPaciente] = await conn.query(
            'INSERT INTO pacientes (nome, prontuario, data_nascimento, convenio, medico_responsavel) VALUES (?, ?, ?, ?, ?)',
            [nome.trim(), prontuario.trim(), data_nascimento, convenio.trim(), medico_responsavel.trim()]
        )

        await conn.query(
            "UPDATE leitos SET status = 'Ocupado', paciente_id = ? WHERE id = ?",
            [resultPaciente.insertId, leito_id]
        )

        await conn.commit()
        res.status(201).json({ mensagem: 'Paciente internado com sucesso' })
    } catch (err) {
        await conn.rollback()
        console.error(err)
        res.status(500).json({ erro: 'Erro ao internar paciente' })
    } finally {
        conn.release()
    }
})

/* ALTA HOSPITALAR */
router.post('/alta', async (req, res) => {
    const { leito_id } = req.body

    if (!leito_id) {
        return res.status(400).json({ erro: 'leito_id é obrigatório' })
    }

    const conn = await db.getConnection()
    try {
        await conn.beginTransaction()

        const [leitos] = await conn.query(
            "SELECT id FROM leitos WHERE id = ? AND status = 'Ocupado'",
            [leito_id]
        )
        if (leitos.length === 0) {
            await conn.rollback()
            return res.status(400).json({ erro: 'Leito não encontrado ou não está ocupado' })
        }

        await conn.query(
            "UPDATE leitos SET status = 'Disponível', paciente_id = NULL WHERE id = ?",
            [leito_id]
        )

        await conn.commit()
        res.json({ mensagem: 'Alta realizada com sucesso' })
    } catch (err) {
        await conn.rollback()
        console.error(err)
        res.status(500).json({ erro: 'Erro ao dar alta' })
    } finally {
        conn.release()
    }
})

/* TRANSFERÊNCIA DE PACIENTE */
router.post('/transferir', async (req, res) => {
    const { leito_origem_id, leito_destino_id } = req.body

    if (!leito_origem_id || !leito_destino_id) {
        return res.status(400).json({ erro: 'leito_origem_id e leito_destino_id são obrigatórios' })
    }

    if (String(leito_origem_id) === String(leito_destino_id)) {
        return res.status(400).json({ erro: 'Leito de origem e destino devem ser diferentes' })
    }

    const conn = await db.getConnection()
    try {
        await conn.beginTransaction()

        const [origem] = await conn.query(
            "SELECT id, paciente_id FROM leitos WHERE id = ? AND status = 'Ocupado'",
            [leito_origem_id]
        )
        if (origem.length === 0) {
            await conn.rollback()
            return res.status(400).json({ erro: 'Leito de origem não encontrado ou não está ocupado' })
        }

        const [destino] = await conn.query(
            "SELECT id FROM leitos WHERE id = ? AND status = 'Disponível'",
            [leito_destino_id]
        )
        if (destino.length === 0) {
            await conn.rollback()
            return res.status(400).json({ erro: 'Leito de destino não disponível' })
        }

        const pacienteId = origem[0].paciente_id

        await conn.query(
            "UPDATE leitos SET status = 'Disponível', paciente_id = NULL WHERE id = ?",
            [leito_origem_id]
        )
        await conn.query(
            "UPDATE leitos SET status = 'Ocupado', paciente_id = ? WHERE id = ?",
            [pacienteId, leito_destino_id]
        )

        await conn.commit()
        res.json({ mensagem: 'Transferência realizada com sucesso' })
    } catch (err) {
        await conn.rollback()
        console.error(err)
        res.status(500).json({ erro: 'Erro ao transferir paciente' })
    } finally {
        conn.release()
    }
})

module.exports = router
