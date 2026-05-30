const express = require('express')
const router = express.Router()

const db = require('../database/db')

router.get('/', (req, res) => {

    const sql = `
        SELECT
            leitos.id,
            leitos.numero,
            setores.nome AS setor,
            leitos.status
        FROM leitos
        JOIN setores
        ON leitos.setor_id = setores.id
    `

    db.query(sql, (err, results) => {

        if(err){
            return res.status(500).json(err)
        }

        res.json(results)
    })
})

module.exports = router