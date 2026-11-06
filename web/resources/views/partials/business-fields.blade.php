<div>
    <label class="label" for="nama_usaha">Nama usaha</label>
    <input class="input" id="nama_usaha" name="nama_usaha" value="{{ old('nama_usaha', $business->nama_usaha) }}" required>
    @error('nama_usaha')<p class="error">{{ $message }}</p>@enderror
</div>
<div class="grid gap-4 sm:grid-cols-2">
    <div>
        <label class="label" for="kota">Kota</label>
        <input class="input" id="kota" name="kota" value="{{ old('kota', $business->kota ?? 'Surabaya') }}">
        @error('kota')<p class="error">{{ $message }}</p>@enderror
    </div>
    <div>
        <label class="label" for="jenis_usaha">Jenis usaha</label>
        <select class="input" id="jenis_usaha" name="jenis_usaha" required>
            @foreach ($jenisUsaha as $j)
                <option value="{{ $j }}" @selected(old('jenis_usaha', $business->jenis_usaha) === $j)>{{ $j }}</option>
            @endforeach
        </select>
        @error('jenis_usaha')<p class="error">{{ $message }}</p>@enderror
    </div>
</div>
<div class="grid grid-cols-2 gap-4">
    <div>
        <label class="label" for="jam_buka">Jam buka</label>
        <input class="input" id="jam_buka" type="time" name="jam_buka" value="{{ old('jam_buka', $business->jam_buka ? substr($business->jam_buka, 0, 5) : '') }}">
        @error('jam_buka')<p class="error">{{ $message }}</p>@enderror
    </div>
    <div>
        <label class="label" for="jam_tutup">Jam tutup</label>
        <input class="input" id="jam_tutup" type="time" name="jam_tutup" value="{{ old('jam_tutup', $business->jam_tutup ? substr($business->jam_tutup, 0, 5) : '') }}">
        @error('jam_tutup')<p class="error">{{ $message }}</p>@enderror
    </div>
</div>
