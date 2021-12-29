import GUI from "./node_modules/lil-gui/dist/lil-gui.esm.js";

const plot_elem = document.getElementById("plot");
const gui_elem = document.getElementById("gui");
const log_elem = document.getElementById("log");

const settings = {
    implicit: false,
    Nt: 300,
    dt: 1,
    Nz: 20,
    p: 200,
    cv: 300,
    H: 1,
    ostep: 0,
    rerun: calc,
    play: play,
    name: "",
    save: save_plot,
    clear: clear_saves,
    play_saves: play_saves,
    ostep2: 0,
}
// GUIを生成
const gui = new GUI({
    container: gui_elem,
    title: "設定"
});
const param = gui.addFolder("パラメータ");
param.add(settings, "implicit").name("*陰解法 Comming Soon");
param.add(settings, "Nt").name("時間分割数 Nt");
param.add(settings, "dt").name("時間増分 dt [sec]");
param.add(settings, "Nz").name("空間分割数 Nz");
param.add(settings, "p").name("荷重 P [kN/m^2]");
param.add(settings, "cv").name("圧密係数 cv [cm^2/day]");
param.add(settings, "H").name("排水距離 H [cm]");
param.add(settings, "rerun").name("実行");
const saves = gui.addFolder("複数の結果を同時に描画");
saves.add(settings, "name").name("保存名");
saves.add(settings, "save").name("セーブ");
saves.add(settings, "clear").name("セーブをクリア");
const ostep2_gui = saves.add(settings, "ostep2", 0, 1, 1).name("セーブ再生のステップ").onChange(plot_saves);
const play_saves_gui = saves.add(settings, "play_saves").name("セーブから再生");
const ostep_gui = gui.add(settings, "ostep", 0, 1, 1).name("ステップ").onChange(plot);
const play_gui = gui.add(settings, "play").name("再生");

var z_array, data_array, theory_data_array, z_array_theory, nt, dt, nz, dz, h, p, cv, uuid;
const nz_theory = 100;

function calc_Terzaghi_explicit(){
    nz = settings.Nz;                           // z分割数
    nt = settings.Nt;                           // 時間分割数
    dt = settings.dt;                           // 時間幅 [sec]]
    p  = settings.p*1000;                       // 荷重 [N/m^2] 
    h  = settings.H/100;                        // 排水距離 [m] *ミスで少し違う値が真値
    cv = settings.cv/(8.64e8);                  // 圧密係数 [m^2/s] 
    dz = 2*h/nz;                                // z格子幅 [m]
    z_array = new Float32Array(nz);             // z座標の配列
    data_array = new Float32Array(nz * nt);     // 全ステップの過剰間隙水圧 [N/m^2]
    const u_prev = new Float32Array(nz);        // 前ステップの過剰間隙水圧 [N/m^2]
    const u_next = new Float32Array(nz);        // 現ステップの過剰間隙水圧 [N/m^2]
    const r  = cv*dt/dz/dz;                     // 計算上用いる係数
    u_prev.fill(p);
    
    for (let istep = 0; istep < nt; istep++) {
        // u_prevを出力
        for (let iz = 0; iz < nz; iz++) {
            data_array[istep*nz+iz] = u_prev[iz];
        }
        // u_nextを計算
        u_next[0] = 0;
        u_next[nz-1] = 0;
        for (let iz = 1; iz < nz-1; iz++) {
            u_next[iz] = (1-2*r)*u_prev[iz] + r*(u_prev[iz-1]+u_prev[iz+1]);
        }
        // u_prevにu_nextをコピー
        u_prev.set(u_next);
    }

    // z座標の配列を作成
    for (let iz = 0; iz < nz; iz++) {
        z_array[iz] = iz*dz;
    }

    calc_Terzaghi_theoritical();

    ostep_gui.min(0).max(nt-1).step(1);
    ostep_gui.setValue(0);
    plot();

    uuid = Date.now();
    log("計算完了")
}

function calc_Terzaghi_theoritical(){
    theory_data_array = new Float32Array(nz_theory * nt);   // 全ステップの過剰間隙水圧 [N/m^2]
    z_array_theory = new Float32Array(nz_theory);
    const hd = h*2-dz;  // 排水距離
    const dz_theory = 2*h/nz_theory;    // 理論解の解像度
    for (let istep = 0; istep < nt; istep++) {
        const t = istep*dt; // 時間t
        for (let iz = 0; iz < nz_theory; iz++) {
            const z = iz*dz_theory;
            let uzt = 0;
            for (let m = 0; m < 10000; m++) {
                const du = (4*p/(2*m+1)/Math.PI) * Math.sin((2*m+1)*Math.PI*z/hd) * Math.exp(-(2*m+1)*(2*m+1)*Math.PI*Math.PI*cv*t/hd/hd);
                if (du < 0.00001)  break;   //ある程度小さくなったら終了
                uzt += du;
            }
            theory_data_array[istep*nz_theory+iz] = uzt;
        }
    }
    // z座標の配列を作成
    for (let iz = 0; iz < nz_theory; iz++) {
        z_array_theory[iz] = iz*dz_theory;
    }
}

function plot(){
    if (!z_array) {log("* プロットするデータなし");return;}

    const config = {
        toImageButtonOptions: {
            format: 'svg',
            filename: `Terzaghi_${settings.implicit?"implicit":"explicit"}_${settings.ostep}`
        },
        responsive: true
    };

    const layout = {
        title: `排水曲線 t=${settings.ostep} step`,
        xaxis: {
            title: "地表面からの深さ z [m]",
            range: [0, 2*h],
        },
        yaxis: {
            title: "過剰間隙水圧 u [N/m^2]",
            range: [0, p*1.1],
        }
    }

    Plotly.newPlot(plot_elem, [{
        x: z_array,
        y: data_array.slice(settings.ostep*nz, settings.ostep*nz+nz),
        mode: "lines+markers",
        name: "FDM"
    }, {
        x: z_array_theory,
        y: theory_data_array.slice(settings.ostep*nz_theory, settings.ostep*nz_theory+nz_theory),
        mode: "lines",
        line: {
            dash: 'dashdot',
            width: 2
        },
        name: "理論解"
    }], layout, config);
}

function calc(){
    if (settings.implicit) {

    } else {
        calc_Terzaghi_explicit()
    }
}

var plots = {}, hmax = 0, pmax = 0, ntmax = 0;;
function save_plot(){
    if (!z_array) {log("* データなし");return;}
    const name = settings.name;
    if (name.length === 0) {log("* 名前が未入力");return;}
    plots[uuid] = {
        x: z_array.slice(0),
        y: data_array.slice(0),
        p: p,
        h: h,
        nz: nz,
        nt: nt,
        name: name
    };
    hmax = Math.max(hmax, h);
    pmax = Math.max(pmax, p);
    ntmax = Math.max(ntmax, nt);
    ostep2_gui.min(0).max(ntmax-1).step(1);
    ostep2_gui.setValue(0);
    log("保存済み: "+name);
}

function clear_saves(){
    plots = {};
    log("保存したプロットを削除しました");
}

function log(mes){
    const div = document.createElement("div");
    div.innerText = mes;
    log_elem.appendChild(div);
}

var timeout;
function play(){
    if (!z_array) {log("* データなし");return;}
    if (timeout) {
        clearTimeout(timeout);
        timeout=null;
        play_gui.name("再生");
        return;
    }
    play_gui.name("停止");

    const animation = (step, max)=>{
        ostep_gui.setValue(step);
        plot();
        if (step+1 <= max){
            timeout = setTimeout(animation, 10, step+1, max);
        } else {
            timeout = null;
            play_gui.name("再生");
        }
    }

    animation(0, nt-1);
}

function plot_saves(){
    if (Object.keys(plots) === 0) {log("* プロットするデータなし");return;}

    const config = {
        toImageButtonOptions: {
            format: 'svg',
            filename: `Terzaghi_${settings.ostep2}`
        },
        responsive: true
    };

    const data = [];
    for (const key in plots) {
        if (Object.hasOwnProperty.call(plots, key)) {
            const plt = plots[key];
            if (settings.ostep2 < plt.nt){
                data.push({
                    x: plt.x,
                    y: plt.y.slice(settings.ostep2*plt.nz, settings.ostep2*plt.nz+plt.nz),
                    name: plt.name,
                    mode: "lines+markers"
                })
            }
        }
    }

    const layout = {
        title: `排水曲線 t=${settings.ostep2} step`,
        xaxis: {
            title: '地表面からの深さ z [m]',
            range: [0, 2*hmax],
        },
        yaxis: {
            title: '過剰間隙水圧 u [N/m^2]',
            range: [0, pmax*1.1],
        }
    }
    Plotly.newPlot(plot_elem, data, layout, config);
}

var timeout2;
function play_saves(){
    if (Object.keys(plots) === 0) {log("* プロットするデータなし");return;}
    if (timeout2) {
        clearTimeout(timeout2);
        timeout2 = null;
        play_saves_gui.name("再生");
        return;
    }
    play_saves_gui.name("停止");

    const animation = (step, max)=>{
        ostep2_gui.setValue(step);
        plot_saves();
        if (step+1 <= max){
            timeout2 = setTimeout(animation, 10, step+1, max);
        } else {
            timeout2 = null;
            play_saves_gui.name("再生");
        }
    }

    animation(0, ntmax-1);
}

calc();