<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('langganan:periksa')->dailyAt('08:00');
