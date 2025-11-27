/**
 * Sistema de Sincronização Cloud ↔ Local
 * Sincroniza dados entre servidor local e cloud
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

class SyncManager {
  constructor(db, config) {
    this.db = db;
    this.cloudUrl = config.cloudUrl;
    this.mode = config.mode;
  }

  /**
   * Executar sincronização completa
   */
  async sync() {
    if (this.mode !== 'local') {
      console.log('⚠️ Sincronização desabilitada (modo cloud)');
      return { success: false, message: 'Modo cloud não sincroniza' };
    }

    const syncId = await this.logSyncStart();
    
    try {
      console.log('🔄 Iniciando sincronização com', this.cloudUrl);
      
      let totalSynced = 0;
      
      // Sincronizar POPs
      const popsSynced = await this.syncPOPs();
      totalSynced += popsSynced;
      console.log(`  ✓ ${popsSynced} POPs sincronizados`);
      
      // Sincronizar Analistas
      const analystsSynced = await this.syncAnalysts();
      totalSynced += analystsSynced;
      console.log(`  ✓ ${analystsSynced} analistas sincronizados`);
      
      // Sincronizar Turnos
      const shiftsSynced = await this.syncShifts();
      totalSynced += shiftsSynced;
      console.log(`  ✓ ${shiftsSynced} turnos sincronizados`);
      
      // Sincronizar Escalas
      const schedulesSynced = await this.syncSchedules();
      totalSynced += schedulesSynced;
      console.log(`  ✓ ${schedulesSynced} escalas sincronizadas`);
      
      await this.logSyncComplete(syncId, totalSynced);
      
      console.log(`✅ Sincronização concluída: ${totalSynced} registros`);
      
      return { 
        success: true, 
        recordsSynced: totalSynced,
        details: {
          pops: popsSynced,
          analysts: analystsSynced,
          shifts: shiftsSynced,
          schedules: schedulesSynced
        }
      };
      
    } catch (error) {
      console.error('❌ Erro na sincronização:', error.message);
      await this.logSyncError(syncId, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sincronizar POPs
   */
  async syncPOPs() {
    try {
      // Buscar clientes únicos no cloud
      const clientsResponse = await axios.get(`${this.cloudUrl}/api/sync/clients`, {
        timeout: 30000
      });
      
      const clients = clientsResponse.data;
      let totalSynced = 0;
      
      for (const client of clients) {
        // Buscar POPs do cliente
        const popsResponse = await axios.get(`${this.cloudUrl}/api/sync/pops/${client}`, {
          timeout: 30000
        });
        
        const pops = popsResponse.data;
        
        // Limpar POPs locais do cliente
        await this.dbRun('DELETE FROM pops WHERE client = ?', [client]);
        
        // Inserir POPs do cloud
        for (const pop of pops) {
          await this.dbRun(
            `INSERT INTO pops (id, client, filename, title, category, icon, data, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              pop.id,
              pop.client,
              pop.filename,
              pop.title,
              pop.category,
              pop.icon,
              pop.data,
              pop.created_at,
              pop.updated_at
            ]
          );
          totalSynced++;
        }
      }
      
      return totalSynced;
    } catch (error) {
      console.error('Erro ao sincronizar POPs:', error.message);
      throw error;
    }
  }

  /**
   * Sincronizar Analistas
   */
  async syncAnalysts() {
    try {
      const response = await axios.get(`${this.cloudUrl}/api/sync/analysts`, {
        timeout: 30000
      });
      
      const analysts = response.data;
      
      // Limpar analistas locais
      await this.dbRun('DELETE FROM analysts');
      
      // Inserir analistas do cloud
      for (const analyst of analysts) {
        await this.dbRun(
          `INSERT INTO analysts (id, name, role, phone, email, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            analyst.id,
            analyst.name,
            analyst.role,
            analyst.phone,
            analyst.email,
            analyst.active,
            analyst.created_at,
            analyst.updated_at
          ]
        );
      }
      
      return analysts.length;
    } catch (error) {
      console.error('Erro ao sincronizar analistas:', error.message);
      throw error;
    }
  }

  /**
   * Sincronizar Turnos
   */
  async syncShifts() {
    try {
      const response = await axios.get(`${this.cloudUrl}/api/sync/shifts`, {
        timeout: 30000
      });
      
      const shifts = response.data;
      
      // Limpar turnos locais
      await this.dbRun('DELETE FROM shifts');
      
      // Inserir turnos do cloud
      for (const shift of shifts) {
        await this.dbRun(
          `INSERT INTO shifts (id, name, start_time, end_time, color, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            shift.id,
            shift.name,
            shift.start_time,
            shift.end_time,
            shift.color,
            shift.created_at,
            shift.updated_at
          ]
        );
      }
      
      return shifts.length;
    } catch (error) {
      console.error('Erro ao sincronizar turnos:', error.message);
      throw error;
    }
  }

  /**
   * Sincronizar Escalas
   */
  async syncSchedules() {
    try {
      const response = await axios.get(`${this.cloudUrl}/api/sync/schedules`, {
        timeout: 30000
      });
      
      const schedules = response.data;
      
      // Limpar escalas locais
      await this.dbRun('DELETE FROM schedules');
      
      // Inserir escalas do cloud
      for (const schedule of schedules) {
        await this.dbRun(
          `INSERT INTO schedules (id, date, shift_id, analyst_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            schedule.id,
            schedule.date,
            schedule.shift_id,
            schedule.analyst_id,
            schedule.created_at,
            schedule.updated_at
          ]
        );
      }
      
      return schedules.length;
    } catch (error) {
      console.error('Erro ao sincronizar escalas:', error.message);
      throw error;
    }
  }

  /**
   * Registrar início da sincronização
   */
  async logSyncStart() {
    const result = await this.dbRun(
      `INSERT INTO sync_log (sync_type, status, started_at) 
       VALUES ('full', 'running', CURRENT_TIMESTAMP)`
    );
    return result.lastID;
  }

  /**
   * Registrar conclusão da sincronização
   */
  async logSyncComplete(syncId, recordsSynced) {
    await this.dbRun(
      `UPDATE sync_log 
       SET status = 'completed', records_synced = ?, completed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [recordsSynced, syncId]
    );
  }

  /**
   * Registrar erro na sincronização
   */
  async logSyncError(syncId, errorMessage) {
    await this.dbRun(
      `UPDATE sync_log 
       SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [errorMessage, syncId]
    );
  }

  /**
   * Obter histórico de sincronizações
   */
  async getSyncHistory(limit = 10) {
    return this.dbAll(
      `SELECT * FROM sync_log 
       ORDER BY started_at DESC 
       LIMIT ?`,
      [limit]
    );
  }

  /**
   * Wrapper para db.run com Promise
   */
  dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  /**
   * Wrapper para db.all com Promise
   */
  dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

/**
 * Configurar cron para sincronização automática
 */
function scheduleSyncCron(syncManager, syncTime = '03:00') {
  const cron = require('node-cron');
  const [hour, minute] = syncTime.split(':');
  
  // Formato cron: minuto hora * * *
  const cronExpression = `${minute} ${hour} * * *`;
  
  cron.schedule(cronExpression, async () => {
    console.log(`\n🕒 Executando sincronização automática (${syncTime})`);
    await syncManager.sync();
  });
  
  console.log(`✓ Sincronização agendada para ${syncTime}`);
}

module.exports = { SyncManager, scheduleSyncCron };
