const fs = require('fs-extra');
const path = require('path');

async function install() {
    try {
        // 1. Encontrar la ubicación de scrypt-ts
        const scryptPath = path.dirname(require.resolve('scrypt-ts'));
        const targetDir = path.join(scryptPath, 'providers');
        
        // 2. Verificar que existe
        if (!fs.existsSync(targetDir)) {
            throw new Error(`scrypt-ts providers directory not found at: ${targetDir}`);
        }
        
        // 3. Copiar archivos
        const sourceFiles = [
            path.join(__dirname, '../dist/gn-provider.js'),
            path.join(__dirname, '../dist/gn-provider.d.ts')
        ];
        
        /*await Promise.all(sourceFiles.map(file => {
            const filename = path.basename(file);
            const target = path.join(targetDir, filename);
            return fs.copy(file, target);
        }));*/

        sourceFiles.forEach(file => {
            const filename = path.basename(file);
            const target = path.join(targetDir, filename);
            
            if (fs.existsSync(file)) {
                fs.copyFileSync(file, target);
                console.log(`✅ Copiado: ${filename} → ${target}`);
            } else {
                console.error(`❌ Archivo no encontrado: ${file}`);
                throw new Error(`Archivo de origen no encontrado: ${file}`);
            }
        });
        
        console.log('✅ GN Provider instalado exitosamente en scrypt-ts');
        console.log(`📍 Ubicación: ${targetDir}`);
        
    } catch (error) {
        console.error('❌ Error instalando GN Provider:', error.message);
        process.exit(1);
    }
}

install();