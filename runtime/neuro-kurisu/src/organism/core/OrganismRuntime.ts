          const persisted = await this.persistRiskAwareRecovery();
          durability.riskAwareRecovery = persisted ? 'durable' : 'failed';
          if (!persisted) capture(new Error('risk-aware-recovery-durability-unconfirmed'));
        } catch (error) {
          durability.riskAwareRecovery = 'failed';
          capture(error);
        }
        try {
          await this.checkpointWorld(true);
          durability.world = 'durable';
        } catch (error) {
          durability.world = 'failed';
          capture(error);
        }
      });
    } catch (error) {
      capture(error);
    }

    // Flush and close are separate obligations: close is still attempted when
    // flush rejects, and neither error can erase module/core shutdown failures.
    let ledgerFlushSucceeded = false;
    let ledgerCloseSucceeded = false;
    let ledgerOperationFailureCaptured = false;
    try {
      await this.continuityLedger.flush();
      ledgerFlushSucceeded = true;
    } catch (error) {
      durability.continuityLedger = 'failed';
      ledgerOperationFailureCaptured = true;
      capture(error);
    }
    try {
      await this.continuityLedger.close();
      ledgerCloseSucceeded = true;
    } catch (error) {
      durability.continuityLedger = 'failed';
      ledgerOperationFailureCaptured = true;
      capture(error);
    }
    try {
      const ledger = this.continuityLedger.diagnostics() as {
        pendingLines?: number;
        pendingBytes?: number;
        lastError?: string | null;
        lastDurabilityWarning?: string | null;
      };
      durability.continuityLedger = ledgerFlushSucceeded && ledgerCloseSucceeded &&
        ledger.pendingLines === 0 && ledger.pendingBytes === 0 &&
        !ledger.lastError && !ledger.lastDurabilityWarning
        ? 'durable'
        : 'failed';
      // Do not infer whether a concrete operation failed from its arbitrary
      // error text. A failed flush/close is already captured above; add the
      // generic diagnostic only when the operations returned but the ledger's
      // own persisted diagnostics still show an unconfirmed durability state.
      if (durability.continuityLedger === 'failed' && !ledgerOperationFailureCaptured) {
        capture(new Error('continuity-ledger-durability-unconfirmed'));
      }
    } catch (error) {
      durability.continuityLedger = 'failed';
      capture(error);
    }

    const worldTick = (() => {
      try { return this.environment.snapshot().tick; } catch { return null; }
    })();
    const overallDurable = runtimeViewRef.current !== null &&
      durability.core === 'durable' &&
      durability.world === 'durable' &&
      durability.continuityLedger === 'durable' &&
      durability.cognitiveSpine === 'durable' &&
      durability.riskAwareRecovery === 'durable' &&
      stopErrors.length === 0;
    const receipt = {
      overall: overallDurable ? 'durable' : 'partial',
      tick: runtimeViewRef.current?.tick ?? null,
      worldTick,
      durability,
      errors: stopErrors.slice(0, 8).map(error =>
        String((error as any)?.message ?? error).slice(0, 180)),
    };
    await this.journal.write(
      overallDurable ? 'info' : 'warn',
      overallDurable ? 'runtime.stop.durable' : 'runtime.stop.partial',
      receipt,
    ).catch(() => {});

    if (stopErrors.length === 1) throw stopErrors[0];
    if (stopErrors.length > 1) {
      throw new AggregateError(stopErrors, 'runtime-stop-incomplete');
    }
  }

  private async persistCognitiveSpineSchedule(): Promise<boolean> {
    try {
      await this.cognitiveSpineStore.save(this.cognitiveSpineScheduler.snapshot());