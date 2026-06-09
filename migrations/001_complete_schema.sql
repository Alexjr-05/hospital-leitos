-- ============================================================
-- MIGRATION 001 — Sistema Hospitalar UMC — Schema Completo
-- Execute este arquivo no seu banco MySQL uma única vez.
-- ============================================================

USE hospital_umc;

-- 1. Expandir status do leito para o fluxo completo
--    Passo A: converte para VARCHAR (evita conflito com ENUM antigo)
ALTER TABLE leitos MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Disponível';

--    Passo B: normaliza qualquer valor fora do padrão para 'Disponível'
SET SQL_SAFE_UPDATES = 0;
UPDATE leitos
SET status = 'Disponível'
WHERE status NOT IN ('Disponível','Ocupado','Higienização','Reservado','Bloqueado');
SET SQL_SAFE_UPDATES = 1;

--    Passo C: converte para o novo ENUM completo
ALTER TABLE leitos
    MODIFY COLUMN status ENUM(
        'Disponível',
        'Ocupado',
        'Higienização',
        'Reservado',
        'Bloqueado'
    ) NOT NULL DEFAULT 'Disponível';

-- 2. Internações (rastreamento completo de internação/alta)
CREATE TABLE IF NOT EXISTS internacoes (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id       INT          NOT NULL,
    leito_id          INT          NOT NULL,
    data_entrada      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_saida        DATETIME     NULL,
    status            ENUM('Ativa', 'Alta') NOT NULL DEFAULT 'Ativa',
    diagnostico       VARCHAR(500) NULL,
    observacoes       TEXT         NULL,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
    FOREIGN KEY (leito_id)    REFERENCES leitos(id)
);

-- 3. Higienizações
CREATE TABLE IF NOT EXISTS higienizacoes (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    leito_id     INT          NOT NULL,
    responsavel  VARCHAR(200) NOT NULL,
    inicio       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fim          DATETIME     NULL,
    status       ENUM('Em Andamento', 'Concluída') NOT NULL DEFAULT 'Em Andamento',
    observacoes  TEXT         NULL,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (leito_id) REFERENCES leitos(id)
);

-- 4. Reservas de leito
CREATE TABLE IF NOT EXISTS reservas (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    leito_id          INT          NOT NULL,
    nome_paciente     VARCHAR(200) NOT NULL,
    convenio          VARCHAR(100) NULL,
    medico            VARCHAR(200) NULL,
    previsao_entrada  DATETIME     NULL,
    observacoes       TEXT         NULL,
    status            ENUM('Ativa', 'Convertida', 'Cancelada') NOT NULL DEFAULT 'Ativa',
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (leito_id) REFERENCES leitos(id)
);

-- 5. Bloqueios de leito
CREATE TABLE IF NOT EXISTS bloqueios (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    leito_id     INT          NOT NULL,
    motivo       ENUM('Manutenção', 'Isolamento', 'Reforma', 'Equipamento') NOT NULL,
    descricao    TEXT         NULL,
    responsavel  VARCHAR(200) NOT NULL,
    inicio       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fim          DATETIME     NULL,
    status       ENUM('Ativo', 'Encerrado') NOT NULL DEFAULT 'Ativo',
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (leito_id) REFERENCES leitos(id)
);

-- 6. Histórico de movimentações (trilha de auditoria completa)
CREATE TABLE IF NOT EXISTS historico_movimentacoes (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    leito_id     INT          NOT NULL,
    paciente_id  INT          NULL,
    acao         ENUM(
                     'Internação',
                     'Alta',
                     'Transferência Saída',
                     'Transferência Entrada',
                     'Reserva',
                     'Reserva Cancelada',
                     'Reserva Convertida',
                     'Bloqueio',
                     'Desbloqueio',
                     'Higienização Iniciada',
                     'Higienização Concluída'
                 ) NOT NULL,
    descricao    TEXT         NULL,
    usuario      VARCHAR(200) NOT NULL DEFAULT 'Sistema',
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (leito_id) REFERENCES leitos(id)
);

-- ============================================================
-- VIEWS PARA POWER BI
-- ============================================================

-- KPIs gerais (atualiza em tempo real)
CREATE OR REPLACE VIEW vw_kpis_gerais AS
SELECT
    COUNT(*)                                                            AS total_leitos,
    SUM(status = 'Disponível')                                         AS disponiveis,
    SUM(status = 'Ocupado')                                            AS ocupados,
    SUM(status = 'Higienização')                                       AS em_higienizacao,
    SUM(status = 'Reservado')                                          AS reservados,
    SUM(status = 'Bloqueado')                                          AS bloqueados,
    ROUND(SUM(status = 'Ocupado') * 100.0 / NULLIF(COUNT(*), 0), 2)  AS taxa_ocupacao_pct
FROM leitos;

-- Ocupação por setor
CREATE OR REPLACE VIEW vw_ocupacao_por_setor AS
SELECT
    s.nome                                                                              AS setor,
    COUNT(l.id)                                                                        AS total_leitos,
    SUM(l.status = 'Disponível')                                                       AS disponiveis,
    SUM(l.status = 'Ocupado')                                                          AS ocupados,
    SUM(l.status = 'Higienização')                                                     AS em_higienizacao,
    SUM(l.status = 'Reservado')                                                        AS reservados,
    SUM(l.status = 'Bloqueado')                                                        AS bloqueados,
    ROUND(SUM(l.status = 'Ocupado') * 100.0 / NULLIF(COUNT(l.id), 0), 2)             AS taxa_ocupacao_pct
FROM leitos l
JOIN setores s ON l.setor_id = s.id
GROUP BY s.id, s.nome;

-- Dimensão Leito (Power BI)
CREATE OR REPLACE VIEW dim_leito AS
SELECT
    l.id,
    l.numero,
    s.nome  AS setor,
    l.status
FROM leitos l
JOIN setores s ON l.setor_id = s.id;

-- Dimensão Paciente (Power BI)
CREATE OR REPLACE VIEW dim_paciente AS
SELECT
    id,
    nome,
    convenio,
    medico_responsavel,
    TIMESTAMPDIFF(YEAR, data_nascimento, CURDATE()) AS idade
FROM pacientes;

-- Dimensão Tempo (Power BI) — baseada nas internações
CREATE OR REPLACE VIEW dim_tempo AS
SELECT DISTINCT
    DATE(data_entrada)                AS data,
    DAY(data_entrada)                 AS dia,
    MONTH(data_entrada)               AS mes,
    YEAR(data_entrada)                AS ano,
    QUARTER(data_entrada)             AS trimestre,
    DAYOFWEEK(data_entrada)           AS dia_semana,
    WEEK(data_entrada)                AS semana_ano
FROM internacoes;

-- Fato Internações (Power BI — tabela fato principal)
CREATE OR REPLACE VIEW fact_internacoes AS
SELECT
    i.id                                                                            AS internacao_id,
    i.paciente_id,
    p.nome                                                                         AS paciente_nome,
    p.convenio,
    TIMESTAMPDIFF(YEAR, p.data_nascimento, CURDATE())                              AS paciente_idade,
    i.leito_id,
    l.numero                                                                       AS leito_numero,
    s.nome                                                                         AS setor,
    i.data_entrada,
    i.data_saida,
    DATEDIFF(COALESCE(i.data_saida, NOW()), i.data_entrada)                       AS dias_internado,
    i.status                                                                       AS status_internacao,
    i.diagnostico,
    DATE(i.data_entrada)                                                           AS data_entrada_date,
    YEAR(i.data_entrada)                                                           AS ano,
    MONTH(i.data_entrada)                                                          AS mes,
    QUARTER(i.data_entrada)                                                        AS trimestre
FROM internacoes i
JOIN pacientes p ON i.paciente_id = p.id
JOIN leitos    l ON i.leito_id    = l.id
JOIN setores   s ON l.setor_id    = s.id;

-- Fato Higienizações (Power BI)
CREATE OR REPLACE VIEW fact_higienizacoes AS
SELECT
    h.id,
    h.leito_id,
    l.numero                                                                       AS leito_numero,
    s.nome                                                                         AS setor,
    h.responsavel,
    h.inicio,
    h.fim,
    TIMESTAMPDIFF(MINUTE, h.inicio, COALESCE(h.fim, NOW()))                       AS duracao_minutos,
    h.status,
    YEAR(h.inicio)                                                                 AS ano,
    MONTH(h.inicio)                                                                AS mes,
    DATE(h.inicio)                                                                 AS data_inicio_date
FROM higienizacoes h
JOIN leitos  l ON h.leito_id  = l.id
JOIN setores s ON l.setor_id  = s.id;
