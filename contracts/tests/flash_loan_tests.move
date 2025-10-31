#[test_only]
module sui_flash_loan::flash_loan_tests {
    use sui::test_scenario::{Self, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui_flash_loan::flash_loan;
    use std::constants;

    const ADMIN: address = @0x42;
    const BORROWER: address = @0x43;

    #[test]
    fun test_create_pool() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        let initial_deposit = coin::mint_for_testing(1000000000, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            flash_loan::create_pool_entry(initial_deposit, 50, 500000000, ctx);
        };
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            
            let (owner, balance, fee_rate, is_paused, loans, fees, version, created, max_loan) = 
                flash_loan::get_pool_info(&pool);
            
            test_scenario::assert!(owner == ADMIN);
            test_scenario::assert!(balance == 1000000000);
            test_scenario::assert!(fee_rate == 50);
            test_scenario::assert!(is_paused == false);
            test_scenario::assert!(loans == 0);
            test_scenario::assert!(fees == 0);
            test_scenario::assert!(version == 1);
            test_scenario::assert!(max_loan == 500000000);
            
            test_scenario::return_shared(pool);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = sui_flash_loan::flash_loan::E_FEE_RATE_TOO_HIGH)]
    fun test_create_pool_invalid_fee_rate() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        let initial_deposit = coin::mint_for_testing(1000000000, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            flash_loan::create_pool_entry(initial_deposit, 600, 500000000, ctx);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_flash_loan_lifecycle() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        // Create pool
        let initial_deposit = coin::mint_for_testing(1000000000, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            flash_loan::create_pool_entry(initial_deposit, 50, 500000000, ctx);
        };
        
        // Request flash loan
        test_scenario::next_tx(&mut scenario, BORROWER);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            
            flash_loan::request_flash_loan_entry(&mut pool, 100000000, ctx);
            
            test_scenario::return_shared(pool);
        };
        
        // Repay flash loan
        test_scenario::next_tx(&mut scenario, BORROWER);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            let capability = test_scenario::take_from_address<flash_loan::FlashLoanCapability>(&scenario, BORROWER);
            let repayment = coin::mint_for_testing(100050000, ctx); // 100M + 0.05% fee
            
            flash_loan::repay_flash_loan_entry(&mut pool, capability, repayment, ctx);
            
            test_scenario::return_shared(pool);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = sui_flash_loan::flash_loan::E_INSUFFICIENT_BALANCE)]
    fun test_insufficient_balance() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        let initial_deposit = coin::mint_for_testing(100000000, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            flash_loan::create_pool_entry(initial_deposit, 50, 500000000, ctx);
        };
        
        test_scenario::next_tx(&mut scenario, BORROWER);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            
            flash_loan::request_flash_loan_entry(&mut pool, 200000000, ctx); // More than pool balance
            
            test_scenario::return_shared(pool);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_pause_and_resume_pool() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        let initial_deposit = coin::mint_for_testing(1000000000, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            flash_loan::create_pool_entry(initial_deposit, 50, 500000000, ctx);
        };
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            
            flash_loan::pause_pool_entry(&mut pool, ctx);
            flash_loan::resume_pool_entry(&mut pool, ctx);
            
            test_scenario::return_shared(pool);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = sui_flash_loan::flash_loan::E_POOL_PAUSED)]
    fun test_flash_loan_on_paused_pool() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        let initial_deposit = coin::mint_for_testing(1000000000, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            flash_loan::create_pool_entry(initial_deposit, 50, 500000000, ctx);
        };
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            
            flash_loan::pause_pool_entry(&mut pool, ctx);
            
            test_scenario::return_shared(pool);
        };
        
        test_scenario::next_tx(&mut scenario, BORROWER);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            
            flash_loan::request_flash_loan_entry(&mut pool, 100000000, ctx); // Should fail
            
            test_scenario::return_shared(pool);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_calculate_flash_loan_cost() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        let initial_deposit = coin::mint_for_testing(1000000000, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            flash_loan::create_pool_entry(initial_deposit, 50, 500000000, ctx);
        };
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            
            let (fee, total) = flash_loan::calculate_flash_loan_cost(&pool, 100000000);
            
            test_scenario::assert!(fee == 50000); // 0.05% of 100M
            test_scenario::assert!(total == 100050000); // 100M + fee
            
            test_scenario::return_shared(pool);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_withdraw_fees() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        let initial_deposit = coin::mint_for_testing(1000000000, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            flash_loan::create_pool_entry(initial_deposit, 50, 500000000, ctx);
        };
        
        // Complete a flash loan to generate fees
        test_scenario::next_tx(&mut scenario, BORROWER);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            
            flash_loan::request_flash_loan_entry(&mut pool, 100000000, ctx);
            
            test_scenario::return_shared(pool);
        };
        
        test_scenario::next_tx(&mut scenario, BORROWER);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            let capability = test_scenario::take_from_address<flash_loan::FlashLoanCapability>(&scenario, BORROWER);
            let repayment = coin::mint_for_testing(100050000, ctx);
            
            flash_loan::repay_flash_loan_entry(&mut pool, capability, repayment, ctx);
            
            test_scenario::return_shared(pool);
        };
        
        // Withdraw fees
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            
            flash_loan::withdraw_fees_entry(&mut pool, 50000, ctx);
            
            test_scenario::return_shared(pool);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = sui_flash_loan::flash_loan::E_UNAUTHORIZED)]
    fun test_unauthorized_pause() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        let initial_deposit = coin::mint_for_testing(1000000000, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            flash_loan::create_pool_entry(initial_deposit, 50, 500000000, ctx);
        };
        
        test_scenario::next_tx(&mut scenario, BORROWER);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            
            flash_loan::pause_pool_entry(&mut pool, ctx); // Unauthorized - should fail
            
            test_scenario::return_shared(pool);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_pool_info_functions() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        let initial_deposit = coin::mint_for_testing(1000000000, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            flash_loan::create_pool_entry(initial_deposit, 50, 500000000, ctx);
        };
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let pool = test_scenario::take_shared<flash_loan::FlashLoanPool>(&scenario);
            
            // Test pool info
            let (_, balance, _, _, _, _, _, _, _) = flash_loan::get_pool_info(&pool);
            test_scenario::assert!(balance == 1000000000);
            
            // Test liquidity check
            test_scenario::assert!(flash_loan::has_sufficient_liquidity(&pool, 500000000));
            test_scenario::assert!(!flash_loan::has_sufficient_liquidity(&pool, 2000000000));
            
            // Test active loans count
            test_scenario::assert!(flash_loan::get_active_loans_count(&pool) == 0);
            
            test_scenario::return_shared(pool);
        };
        
        test_scenario::end(scenario);
    }
}