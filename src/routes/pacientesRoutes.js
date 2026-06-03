const express = require('express')
const router = express.Router()
const db = require('../database/db')

router.post('/', async (req, res) => {
    const { nome, prontuario, data_nascimento, convenio, medico_responsavel } = req.body

    if (!nome || !prontuario || !data_nascimento || !convenio || !medico_responsavel) {
        return res.status(400).json({ erro: 'Todos os campos são obrigatórios' })
    }

    if (typeof nome !== 'string' || nome.trim().length < 2) {
        return res.status(400).json({ erro: 'Nome inválido' })
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(data_nascimento)) {
        return res.status(400).json({ erro: 'Data de nascimento inválida. Use o formato AAAA-MM-DD' })
    }

    try {
        const [result] = await db.query(
            'INSERT INTO pacientes (nome, prontuario, data_nascimento, convenio, medico_responsavel) VALUES (?, ?, ?, ?, ?)',
            [nome.trim(), prontuario.trim(), data_nascimento, convenio.trim(), medico_responsavel.trim()]
        )
        res.status(201).json({ mensagem: 'Paciente cadastrado', id: result.insertId })
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao cadastrar paciente' })
    }
})

router.get('/', async (req, res) => {
    try {
        const [results] = await db.query('SELECT id, nome, prontuario, convenio, medico_responsavel FROM pacientes ORDER BY nome')
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar pacientes' })
    }
})

module.exports = router
