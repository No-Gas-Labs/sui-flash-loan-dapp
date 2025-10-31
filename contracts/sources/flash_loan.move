module sui_flash_loan::flash_loan {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID};
    use std::option::{Self, Option};
    use std::vector;
    use std::type_name;

    /// Errors
    const E_POOL_NOT_INITIALIZED: u64 = 0;
    const E_POOL_PAUSED: u64 = 1;
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    const E_INVALID_AMOUNT: u64 = 3;
    const E_UNAUTHORIZED: u64 = 4;
    const E_LOAN_NOT_FOUND: u64 = 5;
    const E_LOAN_ALREADY_REPAID: u64 = 6;
    const E_INSUFFICIENT_REPAYMENT: u64 = 7;
    const E_FEE_RATE_TOO_HIGH: u64 = 8;
    const E_POOL_HAS_ACTIVE_LOANS: u64 = 9;

    /// Flash Loan Pool - Core pool contract
    struct FlashLoanPool has key, store {
        id: UID,
        owner: address,
        balance: Balance<SUI>,
        fee_rate: u64,              // Fee rate in basis points (100 = 1%)
        is_paused: bool,
        total_loans_issued: u64,
        total_fees_collected: u64,
        pool_version: u64,
        created_at: u64,
        max_loan_amount: u64,
        active_loans: vector<LoanReceipt>
    }

    /// Loan receipt for tracking active loans
    struct LoanReceipt has store {
        loan_id: u64,
        borrower: address,
        amount_borrowed: u64,
        fee_amount: u64,
        timestamp: u64,
        is_repaid: bool
    }

    /// Flash loan capability for authorized callbacks
    struct FlashLoanCapability has key {
        id: UID,
        pool_id: address,
        loan_id: u64
    }

    /// Events
    struct PoolCreated has copy, drop {
        pool_id: address,
        owner: address,
        initial_balance: u64,
        fee_rate: u64,
        timestamp: u64
    }

    struct FlashLoanInitiated has copy, drop {
        pool_id: address,
        loan_id: u64,
        borrower: address,
        amount_borrowed: u64,
        fee_amount: u64,
        timestamp: u64
    }

    struct FlashLoanRepaid has copy, drop {
        pool_id: address,
        loan_id: u64,
        borrower: address,
        amount_repaid: u64,
        fee_collected: u64,
        timestamp: u64
    }

    struct PoolPaused has copy, drop {
        pool_id: address,
        paused_by: address,
        timestamp: u64
    }

    struct PoolResumed has copy, drop {
        pool_id: address,
        resumed_by: address,
        timestamp: u64
    }

    struct PoolUpgraded has copy, drop {
        pool_id: address,
        new_version: u64,
        upgraded_by: address,
        timestamp: u64
    }

    /// Initialize a new flash loan pool
    public fun create_pool(
        owner: address,
        initial_deposit: Coin<SUI>,
        fee_rate: u64,
        max_loan_amount: u64,
        ctx: &mut TxContext
    ) {
        // Validate fee rate (max 5% = 500 basis points)
        assert!(fee_rate <= 500, E_FEE_RATE_TOO_HIGH);
        
        let initial_balance = coin::value(&initial_deposit);
        let pool = FlashLoanPool {
            id: object::new(ctx),
            owner,
            balance: coin::into_balance(initial_deposit),
            fee_rate,
            is_paused: false,
            total_loans_issued: 0,
            total_fees_collected: 0,
            pool_version: 1,
            created_at: tx_context::epoch(ctx),
            max_loan_amount,
            active_loans: vector::empty()
        };

        let pool_id = object::borrow_uid(&mut pool.id);

        // Emit pool creation event
        transfer::public_transfer(PoolCreated {
            pool_id: tx_context::sender(ctx),
            owner,
            initial_balance,
            fee_rate,
            timestamp: tx_context::epoch(ctx)
        }, tx_context::sender(ctx));

        transfer::share_object(pool);
    }

    /// Request a flash loan
    public fun request_flash_loan(
        pool: &mut FlashLoanPool,
        amount: u64,
        ctx: &mut TxContext
    ): (Coin<SUI>, FlashLoanCapability) {
        // Validate pool state
        assert!(!pool.is_paused, E_POOL_PAUSED);
        assert!(amount > 0, E_INVALID_AMOUNT);
        assert!(amount <= pool.max_loan_amount, E_INVALID_AMOUNT);
        assert!(balance::value(&pool.balance) >= amount, E_INSUFFICIENT_BALANCE);

        // Calculate fee
        let fee_amount = (amount * pool.fee_rate) / 10000;
        let total_repayment = amount + fee_amount;

        // Create loan receipt
        let loan_id = pool.total_loans_issued;
        let receipt = LoanReceipt {
            loan_id,
            borrower: tx_context::sender(ctx),
            amount_borrowed: amount,
            fee_amount,
            timestamp: tx_context::epoch(ctx),
            is_repaid: false
        };

        // Create capability
        let capability = FlashLoanCapability {
            id: object::new(ctx),
            pool_id: tx_context::sender(ctx),
            loan_id
        };

        // Transfer loan amount to borrower
        let loan_coin = coin::from_balance(&mut pool.balance, amount, ctx);

        // Update pool state
        pool.total_loans_issued = pool.total_loans_issued + 1;
        vector::push_back(&mut pool.active_loans, receipt);

        // Emit event
        transfer::public_transfer(FlashLoanInitiated {
            pool_id: tx_context::sender(ctx),
            loan_id,
            borrower: tx_context::sender(ctx),
            amount_borrowed: amount,
            fee_amount,
            timestamp: tx_context::epoch(ctx)
        }, tx_context::sender(ctx));

        (loan_coin, capability)
    }

    /// Repay a flash loan
    public fun repay_flash_loan(
        pool: &mut FlashLoanPool,
        capability: FlashLoanCapability,
        repayment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let loan_id = capability.loan_id;
        let receipt = find_and_remove_loan_receipt(&mut pool.active_loans, loan_id);
        
        assert!(receipt.is_repaid == false, E_LOAN_ALREADY_REPAID);
        
        let repayment_amount = coin::value(&repayment);
        let required_repayment = receipt.amount_borrowed + receipt.fee_amount;
        
        assert!(repayment_amount >= required_repayment, E_INSUFFICIENT_REPAYMENT);

        // Add repayment back to pool
        coin::put(&mut pool.balance, repayment);

        // Update statistics
        pool.total_fees_collected = pool.total_fees_collected + receipt.fee_amount;

        // Mark loan as repaid
        let updated_receipt = LoanReceipt {
            is_repaid: true,
            ..receipt
        };
        vector::push_back(&mut pool.active_loans, updated_receipt);

        // Emit event
        transfer::public_transfer(FlashLoanRepaid {
            pool_id: tx_context::sender(ctx),
            loan_id,
            borrower: receipt.borrower,
            amount_repaid: repayment_amount,
            fee_collected: receipt.fee_amount,
            timestamp: tx_context::epoch(ctx)
        }, tx_context::sender(ctx));

        // Destroy capability
        let FlashLoanCapability { id, pool_id: _, loan_id: _ } = capability;
        object::delete(id);
    }

    /// Pause the pool (emergency stop)
    public fun pause_pool(pool: &mut FlashLoanPool, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == pool.owner, E_UNAUTHORIZED);
        
        pool.is_paused = true;

        transfer::public_transfer(PoolPaused {
            pool_id: tx_context::sender(ctx),
            paused_by: tx_context::sender(ctx),
            timestamp: tx_context::epoch(ctx)
        }, tx_context::sender(ctx));
    }

    /// Resume the pool
    public fun resume_pool(pool: &mut FlashLoanPool, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == pool.owner, E_UNAUTHORIZED);
        
        pool.is_paused = false;

        transfer::public_transfer(PoolResumed {
            pool_id: tx_context::sender(ctx),
            resumed_by: tx_context::sender(ctx),
            timestamp: tx_context::epoch(ctx)
        }, tx_context::sender(ctx));
    }

    /// Update pool parameters
    public fun update_pool_params(
        pool: &mut FlashLoanPool,
        new_fee_rate: u64,
        new_max_loan_amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == pool.owner, E_UNAUTHORIZED);
        assert!(new_fee_rate <= 500, E_FEE_RATE_TOO_HIGH);
        
        pool.fee_rate = new_fee_rate;
        pool.max_loan_amount = new_max_loan_amount;
    }

    /// Withdraw fees (owner only)
    public fun withdraw_fees(
        pool: &mut FlashLoanPool,
        amount: u64,
        ctx: &mut TxContext
    ): Coin<SUI> {
        assert!(tx_context::sender(ctx) == pool.owner, E_UNAUTHORIZED);
        assert!(amount <= pool.total_fees_collected, E_INSUFFICIENT_BALANCE);
        
        pool.total_fees_collected = pool.total_fees_collected - amount;
        coin::from_balance(&mut pool.balance, amount, ctx)
    }

    /// Get pool information
    public fun get_pool_info(
        pool: &FlashLoanPool
    ): (address, u64, u64, bool, u64, u64, u64, u64, u64) {
        (
            pool.owner,
            balance::value(&pool.balance),
            pool.fee_rate,
            pool.is_paused,
            pool.total_loans_issued,
            pool.total_fees_collected,
            pool.pool_version,
            pool.created_at,
            pool.max_loan_amount
        )
    }

    /// Get active loans count
    public fun get_active_loans_count(pool: &FlashLoanPool): u64 {
        vector::length(&pool.active_loans)
    }

    /// Check if pool has sufficient liquidity
    public fun has_sufficient_liquidity(
        pool: &FlashLoanPool,
        amount: u64
    ): bool {
        balance::value(&pool.balance) >= amount
    }

    /// Calculate flash loan cost
    public fun calculate_flash_loan_cost(
        pool: &FlashLoanPool,
        amount: u64
    ): (u64, u64) {
        let fee_amount = (amount * pool.fee_rate) / 10000;
        let total_repayment = amount + fee_amount;
        (fee_amount, total_repayment)
    }

    /// Helper function to find and remove loan receipt
    fun find_and_remove_loan_receipt(
        receipts: &mut vector<LoanReceipt>,
        loan_id: u64
    ): LoanReceipt {
        let len = vector::length(receipts);
        let i = 0;
        
        while (i < len) {
            let receipt = vector::borrow(receipts, i);
            if (receipt.loan_id == loan_id) {
                return vector::remove(receipts, i)
            };
            i = i + 1;
        };
        
        abort E_LOAN_NOT_FOUND
    }

    /// Entry function for creating pool
    public entry fun create_pool_entry(
        initial_deposit: Coin<SUI>,
        fee_rate: u64,
        max_loan_amount: u64,
        ctx: &mut TxContext
    ) {
        create_pool(tx_context::sender(ctx), initial_deposit, fee_rate, max_loan_amount, ctx);
    }

    /// Entry function for requesting flash loan
    public entry fun request_flash_loan_entry(
        pool: &mut FlashLoanPool,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let (loan_coin, capability) = request_flash_loan(pool, amount, ctx);
        transfer::public_transfer(loan_coin, tx_context::sender(ctx));
        transfer::public_transfer(capability, tx_context::sender(ctx));
    }

    /// Entry function for repaying flash loan
    public entry fun repay_flash_loan_entry(
        pool: &mut FlashLoanPool,
        capability: FlashLoanCapability,
        repayment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        repay_flash_loan(pool, capability, repayment, ctx);
    }

    /// Entry function for pausing pool
    public entry fun pause_pool_entry(pool: &mut FlashLoanPool, ctx: &mut TxContext) {
        pause_pool(pool, ctx);
    }

    /// Entry function for resuming pool
    public entry fun resume_pool_entry(pool: &mut FlashLoanPool, ctx: &mut TxContext) {
        resume_pool(pool, ctx);
    }

    /// Entry function for updating pool parameters
    public entry fun update_pool_params_entry(
        pool: &mut FlashLoanPool,
        new_fee_rate: u64,
        new_max_loan_amount: u64,
        ctx: &mut TxContext
    ) {
        update_pool_params(pool, new_fee_rate, new_max_loan_amount, ctx);
    }

    /// Entry function for withdrawing fees
    public entry fun withdraw_fees_entry(
        pool: &mut FlashLoanPool,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let fees = withdraw_fees(pool, amount, ctx);
        transfer::public_transfer(fees, tx_context::sender(ctx));
    }
}